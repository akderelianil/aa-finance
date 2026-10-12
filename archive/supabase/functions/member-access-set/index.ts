import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { loadMember } from '../_shared/entries.ts'

// Group admin: what one member may do with another member's journal entries (everyone always views).
// Request: { member_id, target_member_id, level: 'view' | 'edit' | 'delete' }. 'view' removes the right.
const LEVELS = ['view', 'edit', 'delete']

serve(async (req, user) => {
  const body = await readBody(req)
  const { member_id: who, target_member_id: target, level } = body
  if (typeof who !== 'string' || typeof target !== 'string' || who === target) {
    throw new HttpError(422, 'member geçersiz', 'invalid_member')
  }
  if (typeof level !== 'string' || !LEVELS.includes(level)) throw new HttpError(422, 'level geçersiz', 'invalid_level')

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    if (m.role !== 'admin') throw new HttpError(403, 'Bu işlemi sadece grup yöneticisi yapabilir', 'not_admin')
    await setActor(tx, m.member_id)
    const found = await tx`
      select id from members where group_id = ${m.group_id} and id = any(${[who, target]}::uuid[])`
    if (found.length !== 2) throw new HttpError(422, 'member geçersiz', 'invalid_member')
    if (level === 'view') {
      await tx`delete from member_access where member_id = ${who} and target_member_id = ${target}`
    } else {
      await tx`
        insert into member_access (group_id, member_id, target_member_id, level)
        values (${m.group_id}, ${who}, ${target}, ${level})
        on conflict (member_id, target_member_id) do update set level = excluded.level`
    }
  })
  return { ok: true }
})
