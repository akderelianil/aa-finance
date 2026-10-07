import { createClient } from 'npm:@supabase/supabase-js@2.117.2'
import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { loadMember, loadOwnedEntry } from '../_shared/entries.ts'

// Eki siler (satır + dosya). Yalnız kaydın sahibi.
serve(async (req, user) => {
  const body = await readBody(req)
  if (typeof body.attachment_id !== 'string') throw new HttpError(422, 'attachment_id geçersiz', 'invalid_attachment')

  const key = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const [a] = await tx`select id, entry_id, storage_key from attachments where id = ${body.attachment_id as string} and group_id = ${m.group_id}`
    if (!a) throw new HttpError(404, 'Ek bulunamadı', 'not_found')
    await loadOwnedEntry(tx, a.entry_id, m)
    await tx`delete from attachments where id = ${a.id}`
    return a.storage_key as string
  })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  await admin.storage.from('attachments').remove([key])
  return { ok: true }
})
