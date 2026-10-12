import { HttpError, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { applyAccountTemplate } from '../_shared/accounts.ts'

// Add the recommended Gelir/Gider accounts to an existing group (group admin only). Idempotent: an existing
// account with the same name is adopted, nothing is duplicated. Request: {}
serve(async (_req, user) => {
  await sql.begin(async (tx) => {
    const [m] = await tx`select id, group_id, role from members where user_id = ${user.id}`
    if (!m) throw new HttpError(403, 'Bir gruba üye değilsin', 'no_group')
    if (m.role !== 'admin') throw new HttpError(403, 'Bu işlemi sadece grup yöneticisi yapabilir', 'not_admin')
    await setActor(tx, m.id)
    await applyAccountTemplate(tx, m.group_id, true)
  })
  return { ok: true }
})
