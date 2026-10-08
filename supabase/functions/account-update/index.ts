import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { parseAccountFields } from '../_shared/accounts.ts'
import { loadMember } from '../_shared/entries.ts'

// Edit an account of the group Chart of Accounts (GnuCash "Edit Account"). Any member can edit.
// Request: { account_id, name?, code?, parent_id? (null = root), currency?, subtype?, owner_member_id?,
//            is_placeholder?, archived? }. A missing field stays.
// A locked system account (roots, groups, receivable, payable) keeps name, parent, kind, group flag and archive state.
// DB triggers: an account with lines keeps its type and currency and cannot become a placeholder;
// a parent has the same type and is not a system account; no cycle. A system account cannot be archived.
serve(async (req, user) => {
  const body = await readBody(req)
  if (typeof body.account_id !== 'string') throw new HttpError(422, 'account_id geçersiz', 'invalid_account')

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const [a] = await tx`
      select id, type, subtype, system_key, locked from accounts
      where id = ${body.account_id} and group_id = ${m.group_id} for update`
    if (!a) throw new HttpError(404, 'Hesap bulunamadı', 'not_found')
    const f = await parseAccountFields(tx, m.group_id, a.type as string, body)
    if (a.locked && ['name', 'parent_id', 'subtype', 'is_placeholder', 'archived'].some((k) => body[k] !== undefined)) {
      throw new HttpError(422, 'Sistem hesabı değiştirilemez', 'locked_account')
    }

    const guard = async (q: () => Promise<unknown>, code: string, message: string) => {
      try {
        await q()
      } catch (e) {
        if ((e as { code?: string }).code === '23514') throw new HttpError(422, message, code)
        throw e
      }
    }

    if (body.name !== undefined) {
      await tx`update accounts set name = ${requireString(body.name, 'name', 80)} where id = ${a.id}`
    }
    if (f.code !== undefined) await tx`update accounts set code = ${f.code} where id = ${a.id}`
    if (f.subtype !== undefined) await tx`update accounts set subtype = ${f.subtype} where id = ${a.id}`
    if (f.owner !== undefined) await tx`update accounts set owner_member_id = ${f.owner} where id = ${a.id}`
    if (f.currency !== undefined) {
      await guard(() => tx`update accounts set currency = ${f.currency!} where id = ${a.id}`,
        'account_has_records', 'Kaydı olan hesabın para birimi değişmez')
    }
    if (body.parent_id !== undefined) {
      if (body.parent_id !== null && typeof body.parent_id !== 'string') {
        throw new HttpError(422, 'parent_id geçersiz', 'invalid_parent')
      }
      if (body.parent_id) {
        const [p] = await tx`select archived_at from accounts where id = ${body.parent_id} and group_id = ${m.group_id}`
        if (!p || p.archived_at) throw new HttpError(422, 'Üst hesap geçersiz', 'invalid_parent')
      }
      await guard(() => tx`update accounts set parent_id = ${(body.parent_id as string | null) ?? null} where id = ${a.id}`,
        'invalid_parent', 'Üst hesap geçersiz')
    }
    if (typeof body.is_placeholder === 'boolean') {
      await guard(() => tx`update accounts set is_placeholder = ${body.is_placeholder as boolean} where id = ${a.id}`,
        'account_has_records', 'Kaydı olan hesap grup hesabı olamaz')
    }
    if (body.archived !== undefined) {
      if (a.system_key && body.archived) throw new HttpError(422, 'Sistem hesabı arşivlenemez', 'system_account')
      await tx`update accounts set archived_at = ${body.archived ? new Date() : null} where id = ${a.id}`
    }
  })

  return { ok: true }
})
