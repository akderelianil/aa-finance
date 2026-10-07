import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { saveCardDays } from '../_shared/accounts.ts'
import { loadMember } from '../_shared/entries.ts'

// Hesap/kategori yeniden adlandırma ve arşivleme (silme yok; geçmiş kayıtlar korunur).
// is_placeholder: gruplayıcı yap/kaldır; kaydı olan hesap gruplayıcı olamaz (DB trigger'ı).
// Hesap: yalnız sahibi. Kategori (grup geneli): grubun herhangi bir üyesi. Sistem hesapları değişmez.
serve(async (req, user) => {
  const body = await readBody(req)
  if (typeof body.account_id !== 'string') throw new HttpError(422, 'account_id geçersiz', 'invalid_account')

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const [a] = await tx`
      select id, type, subtype, owner_member_id, system_key from accounts
      where id = ${body.account_id as string} and group_id = ${m.group_id} for update`
    if (!a) throw new HttpError(404, 'Hesap bulunamadı', 'not_found')
    if (a.system_key) throw new HttpError(422, 'Sistem hesabı değiştirilemez', 'system_account')
    const isCategory = a.type === 'income' || a.type === 'expense'
    if (!isCategory && a.owner_member_id !== m.member_id) {
      throw new HttpError(403, 'Bu hesabı sadece sahibi değiştirebilir', 'not_owner')
    }

    if (a.subtype === 'credit_card') await saveCardDays(tx, a.id, body)
    if (body.name !== undefined) {
      await tx`update accounts set name = ${requireString(body.name, 'name', 60)} where id = ${a.id}`
    }
    if (body.parent_id !== undefined) {
      if (body.parent_id !== null && typeof body.parent_id !== 'string') {
        throw new HttpError(422, 'parent_id geçersiz', 'invalid_parent')
      }
      if (body.parent_id) {
        const [p] = await tx`
          select owner_member_id, archived_at from accounts
          where id = ${body.parent_id as string} and group_id = ${m.group_id}`
        if (!p) throw new HttpError(404, 'Üst hesap bulunamadı', 'not_found')
        if (p.archived_at) throw new HttpError(422, 'Üst hesap arşivde', 'parent_archived')
        if (!isCategory && p.owner_member_id !== m.member_id) throw new HttpError(403, 'Bu hesabı sadece sahibi değiştirebilir', 'not_owner')
      }
      // Tip/grup/sahip/para birimi uyumu ve döngü kontrolü DB trigger'ında (accounts_parent_chk).
      try {
        await tx`update accounts set parent_id = ${(body.parent_id as string | null) ?? null} where id = ${a.id}`
      } catch (e) {
        if ((e as { code?: string }).code === '23514') throw new HttpError(422, 'Geçersiz üst hesap', 'invalid_parent')
        throw e
      }
    }
    if (typeof body.is_placeholder === 'boolean') {
      try {
        await tx`update accounts set is_placeholder = ${body.is_placeholder} where id = ${a.id}`
      } catch (e) {
        if ((e as { code?: string }).code === '23514') throw new HttpError(422, 'Kaydı olan hesap gruplayıcı olamaz', 'account_has_records')
        throw e
      }
    }
    if (body.archived !== undefined) {
      await tx`update accounts set archived_at = ${body.archived ? new Date() : null} where id = ${a.id}`
    }
  })

  return { ok: true }
})
