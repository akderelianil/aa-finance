import { HttpError, readBody, serve } from '../_shared/http.ts'
import { sql } from '../_shared/db.ts'
import { entryDate, loadMember } from '../_shared/entries.ts'
import { dayRate } from '../_shared/fx.ts'

// Day rate for the journal form: { currency, date? } → { rate } (1 currency = rate base currency).
// Same lookup as journal-post: saved rate of the day, TCMB (saved), last saved rate.
serve(async (req, user) => {
  const body = await readBody(req)
  const currency = typeof body.currency === 'string' ? body.currency : ''
  if (!/^[A-Z]{3}$/.test(currency)) throw new HttpError(422, 'currency geçersiz', 'invalid_currency')
  const date = entryDate(body.date)
  const rate = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    if (currency === m.base_currency) return '1'
    return await dayRate(tx, m.group_id, currency, m.base_currency, date)
  })
  return { rate }
})
