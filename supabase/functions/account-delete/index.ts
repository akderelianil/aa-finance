import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { loadMember } from '../_shared/entries.ts'

// Hesap/kategori silme. Alt ağaç dahil hiçbir yerde kayıt/plan/yatırım işlemi yoksa gerçekten siler;
// varsa geçmişi korumak için alt ağaçla birlikte arşivler. Yanıt: { deleted: true } veya { archived: true }.
// Yetki: hesap yalnız sahibi; kategori grubun herhangi bir üyesi. Sistem hesapları silinemez.
serve(async (req, user) => {
  const body = await readBody(req)
  if (typeof body.account_id !== 'string') throw new HttpError(422, 'account_id geçersiz', 'invalid_account')

  return await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const [a] = await tx`
      select id, type, owner_member_id from accounts
      where id = ${body.account_id as string} and group_id = ${m.group_id} for update`
    if (!a) throw new HttpError(404, 'Hesap bulunamadı', 'not_found')
    const isCategory = a.type === 'income' || a.type === 'expense'
    if (!isCategory && a.owner_member_id !== m.member_id) {
      throw new HttpError(403, 'Bu hesabı sadece sahibi silebilir', 'not_owner')
    }

    const tree = await tx`
      with recursive t as (
        select id from accounts where id = ${a.id}
        union all
        select c.id from accounts c join t on c.parent_id = t.id
      )
      select a2.id, a2.system_key, a2.owner_member_id, a2.type from accounts a2 join t on t.id = a2.id for update of a2`
    if (tree.some((n) => n.system_key)) throw new HttpError(422, 'Sistem hesabı silinemez', 'system_account')
    // Alt hesaplar başkasının olamaz (trigger aynı sahibi zorlar); kategoriler grup geneli.
    const ids = tree.map((n) => n.id as string)

    const [used] = await tx`
      select (
        exists (select 1 from journal_lines where account_id = any(${ids}::uuid[]))
        or exists (select 1 from installment_plans where card_account_id = any(${ids}::uuid[]))
        or exists (select 1 from investment_trades where account_id = any(${ids}::uuid[]))
        or exists (select 1 from accounts where id = any(${ids}::uuid[]) and instrument_id is not null)
      ) as used`

    if (used.used) {
      await tx`update accounts set archived_at = now() where id = any(${ids}::uuid[]) and archived_at is null`
      return { archived: true }
    }
    await tx`delete from credit_card_settings where account_id = any(${ids}::uuid[])`
    // Yapraklardan köke: parent_id FK'si sırayı zorlar; tek ifadede silmek için önce üst bağlantılarını boşalt.
    await tx`update accounts set parent_id = null where id = any(${ids}::uuid[])`
    await tx`delete from accounts where id = any(${ids}::uuid[])`
    return { deleted: true }
  })
})
