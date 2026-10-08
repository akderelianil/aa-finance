import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { loadMember } from '../_shared/entries.ts'

// Rehber kaydını listeden kaldırır (arşiv). Geçmiş kayıtlar ismi göstermeye devam eder.
// Açık borç/alacağı olan kişi kaldırılamaz.
serve(async (req, user) => {
  const body = await readBody(req)
  if (typeof body.id !== 'string') throw new HttpError(422, 'id geçersiz', 'not_found')

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const [c] = await tx`select id from contacts where id = ${body.id as string} and group_id = ${m.group_id} for update`
    if (!c) throw new HttpError(404, 'Kayıt bulunamadı', 'not_found')
    const [open] = await tx`
      select 1 from contact_ledger_balances where contact_id = ${c.id} and net_base_amount <> 0`
    if (open) throw new HttpError(422, 'Açık borç/alacak var', 'contact_has_balance')
    await tx`delete from brand_businesses where brand_id = ${c.id} or business_id = ${c.id}`
    await tx`update contacts set archived_at = now() where id = ${c.id}`
  })

  return { ok: true }
})
