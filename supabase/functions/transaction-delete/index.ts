import { readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { loadMember, loadOwnedEntry, softDeleteEntry } from '../_shared/entries.ts'

// Soft delete: kayıt ve satırları kalır, raporlar deleted_at'a bakar.
serve(async (req, user) => {
  const body = await readBody(req)

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const entry = await loadOwnedEntry(tx, body.entry_id, m)
    await softDeleteEntry(tx, entry.id, m.member_id)
  })

  return { ok: true }
})
