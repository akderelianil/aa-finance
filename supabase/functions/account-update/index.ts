import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { loadMember } from '../_shared/entries.ts'

// Hesap/kategori yeniden adlandırma ve arşivleme (silme yok; geçmiş kayıtlar korunur).
// Hesap: yalnız sahibi. Kategori (grup geneli): grubun herhangi bir üyesi. Sistem hesapları değişmez.
serve(async (req, user) => {
  const body = await readBody(req)
  if (typeof body.account_id !== 'string') throw new HttpError(422, 'account_id geçersiz', 'invalid_account')

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const [a] = await tx`
      select id, type, owner_member_id, system_key from accounts
      where id = ${body.account_id as string} and group_id = ${m.group_id} for update`
    if (!a) throw new HttpError(404, 'Hesap bulunamadı', 'not_found')
    if (a.system_key) throw new HttpError(422, 'Sistem hesabı değiştirilemez', 'system_account')
    const isCategory = a.type === 'income' || a.type === 'expense'
    if (!isCategory && a.owner_member_id !== m.member_id) {
      throw new HttpError(403, 'Bu hesabı sadece sahibi değiştirebilir', 'not_owner')
    }

    if (body.name !== undefined) {
      await tx`update accounts set name = ${requireString(body.name, 'name', 60)} where id = ${a.id}`
    }
    if (body.archived !== undefined) {
      await tx`update accounts set archived_at = ${body.archived ? new Date() : null} where id = ${a.id}`
    }
  })

  return { ok: true }
})
