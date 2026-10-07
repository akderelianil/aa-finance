import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'

// Grup ayarı (yalnız yönetici): dönem kilidi. lock_date dahil o tarihe kadarki kayıtlar değiştirilemez; null = kilit yok.
serve(async (req, user) => {
  const body = await readBody(req)
  let lock: string | null = null
  if (body.lock_date !== null && body.lock_date !== undefined && body.lock_date !== '') {
    const s = typeof body.lock_date === 'string' ? body.lock_date : ''
    const d = new Date(s + 'T00:00:00Z')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(d.getTime()) || !d.toISOString().startsWith(s) || s < '2000-01-01') {
      throw new HttpError(422, 'lock_date geçersiz', 'invalid_lock_date')
    }
    lock = s
  }

  await sql.begin(async (tx) => {
    const [m] = await tx`select id, group_id, role from members where user_id = ${user.id}`
    if (!m) throw new HttpError(403, 'Bir gruba üye değilsin', 'no_group')
    if (m.role !== 'admin') throw new HttpError(403, 'Bu işlemi sadece grup yöneticisi yapabilir', 'not_admin')
    await setActor(tx, m.id)
    await tx`update groups set lock_date = ${lock} where id = ${m.group_id}`
  })

  return { ok: true }
})
