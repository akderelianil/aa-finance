import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import { loadMember, loadOwnedEntry } from '../_shared/entries.ts'

// Kayda ek (fiş/fatura) ekler: satır açılır, istemciye tek kullanımlık imzalı yükleme jetonu döner.
// Yalnız kaydın sahibi ekleyebilir.
const MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
const MAX_BYTES = 10 * 1024 * 1024

serve(async (req, user) => {
  const body = await readBody(req)
  const filename = requireString(body.filename, 'filename', 150)
  const mime = typeof body.mime_type === 'string' ? body.mime_type : ''
  const size = Number(body.size_bytes)
  if (!MIME.includes(mime)) throw new HttpError(422, 'Dosya türü desteklenmiyor', 'invalid_file_type')
  if (!Number.isInteger(size) || size <= 0 || size > MAX_BYTES) throw new HttpError(422, 'Dosya çok büyük', 'file_too_large')

  const id = uuidv7()
  const result = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const entry = await loadOwnedEntry(tx, body.entry_id, m)
    const safe = filename.replace(/[^\w.\-]+/g, '_').slice(-80)
    const key = `${m.group_id}/${entry.id}/${id}-${safe}`
    await tx`
      insert into attachments (id, group_id, entry_id, uploaded_by, filename, mime_type, size_bytes, storage_key)
      values (${id}, ${m.group_id}, ${entry.id}, ${m.member_id}, ${filename}, ${mime}, ${size}, ${key})`
    return key
  })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await admin.storage.from('attachments').createSignedUploadUrl(result)
  if (error || !data) {
    await sql`delete from attachments where id = ${id}`
    throw error ?? new Error('signed upload url failed')
  }
  return { attachment_id: id, path: data.path, token: data.token }
}, 201)
