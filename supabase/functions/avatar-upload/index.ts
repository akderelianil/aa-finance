import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { HttpError, readBody, serve } from '../_shared/http.ts'
import { sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'

// Profil (target=user) veya aile/grup (target=group, yalnız yönetici) görseli için imzalı yükleme jetonu verir.
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

serve(async (req, user) => {
  const body = await readBody(req)
  const ext = EXT[typeof body.mime_type === 'string' ? body.mime_type : '']
  if (!ext) throw new HttpError(422, 'Dosya türü desteklenmiyor', 'invalid_file_type')

  let folder = `users/${user.id}`
  if (body.target === 'group') {
    const [m] = await sql`select group_id, role from members where user_id = ${user.id}`
    if (!m) throw new HttpError(403, 'Bir gruba üye değilsin', 'no_group')
    if (m.role !== 'admin') throw new HttpError(403, 'Bu işlemi sadece grup yöneticisi yapabilir', 'not_admin')
    folder = `groups/${m.group_id}`
  } else if (body.target !== 'user') {
    throw new HttpError(422, 'target geçersiz', 'invalid_target')
  }

  const path = `${folder}/${uuidv7()}.${ext}`
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await admin.storage.from('avatars').createSignedUploadUrl(path)
  if (error || !data) throw error ?? new Error('signed upload url failed')
  return { path, token: data.token }
}, 201)
