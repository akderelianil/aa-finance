import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'

// Grup ayarı (yalnız yönetici): ad, tür (aile/grup), görsel, dönem kilidi (hepsi opsiyonel).
// Dönem kilidi: lock_date dahil o tarihe kadarki kayıtlar değiştirilemez; null = kilit yok.
serve(async (req, user) => {
  const body = await readBody(req)
  const hasLock = body.lock_date !== undefined
  const name = body.name === undefined ? null : requireString(body.name, 'name', 100)
  const kind = body.kind === undefined ? null : body.kind
  if (kind !== null && kind !== 'family' && kind !== 'group') throw new HttpError(422, 'kind geçersiz', 'invalid_kind')
  const hasAvatar = body.avatar_path !== undefined
  let avatar: string | null = null
  if (hasAvatar && body.avatar_path !== null) avatar = requireString(body.avatar_path, 'avatar_path', 200)
  let lock: string | null = null
  if (hasLock && body.lock_date !== null && body.lock_date !== '') {
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
    if (avatar !== null && !avatar.startsWith(`groups/${m.group_id}/`)) throw new HttpError(422, 'avatar_path geçersiz', 'invalid_avatar')
    await tx`
      update groups set
        name = coalesce(${name}, name),
        kind = coalesce(${kind}, kind),
        lock_date = case when ${hasLock} then ${lock}::date else lock_date end,
        avatar_url = case when ${hasAvatar} then ${avatar} else avatar_url end
      where id = ${m.group_id}`
  })

  return { ok: true }
})
