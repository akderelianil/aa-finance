import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { sql } from '../_shared/db.ts'

// Kendi profilini günceller: ad, soyad, fotoğraf (avatar-upload'dan dönen yol; null = kaldır).
serve(async (req, user) => {
  const body = await readBody(req)
  const first = body.first_name === undefined ? null : requireString(body.first_name, 'first_name')
  const last = body.last_name === undefined ? null : requireString(body.last_name, 'last_name')
  const hasAvatar = body.avatar_path !== undefined
  let avatar: string | null = null
  if (hasAvatar && body.avatar_path !== null) {
    avatar = requireString(body.avatar_path, 'avatar_path', 200)
    if (!avatar.startsWith(`users/${user.id}/`)) throw new HttpError(422, 'avatar_path geçersiz', 'invalid_avatar')
  }
  await sql`
    update profiles set
      first_name = coalesce(${first}, first_name),
      last_name = coalesce(${last}, last_name),
      avatar_url = case when ${hasAvatar} then ${avatar} else avatar_url end
    where id = ${user.id}`
  return { ok: true }
})
