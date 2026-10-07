import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import { assertNotLocked, entryDate, loadMember, parseAmount, postEntry, resolveAccount } from '../_shared/entries.ts'
import { addDays, parseDays, parseRatePercent } from '../_shared/deposit.ts'

// Vadeli hesap aç (Transfer → yeni vadeli hesap): para hesaptan vadeliye geçer; gelir/gider yok.
//   Borç vadeli / Alacak kaynak hesap
// Girdi: anapara (amount), yıllık oran %, gün; isteğe bağlı stopaj %, ad, vade sonu dönülecek hesap.
serve(async (req, user) => {
  const body = await readBody(req)
  const rate = parseRatePercent(body.annual_rate, 'annual_rate')
  const days = parseDays(body.days)
  const withholding = body.withholding_rate === undefined || body.withholding_rate === null || body.withholding_rate === ''
    ? '0' : parseRatePercent(body.withholding_rate, 'withholding_rate', 100)
  const date = entryDate(body.date)
  const fromId = typeof body.from_account_id === 'string' && body.from_account_id ? body.from_account_id : undefined
  const returnId = typeof body.return_account_id === 'string' && body.return_account_id ? body.return_account_id : null

  const result = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    const amount = parseAmount(body.amount, m.exponent)
    const from = await resolveAccount(tx, m.group_id, m.member_id, m.base_currency, fromId)
    const [src] = await tx`select name, subtype from accounts where id = ${from}`
    if (src.subtype === 'credit_card' || src.subtype === 'loan') throw new HttpError(422, 'Kaynak hesap geçersiz', 'invalid_account')
    if (returnId) await resolveAccount(tx, m.group_id, m.member_id, m.base_currency, returnId)
    const name = body.name ? requireString(body.name, 'name', 60) : `Vadeli · ${src.name}`.slice(0, 60)

    const id = uuidv7()
    await tx`
      insert into accounts (id, group_id, owner_member_id, type, subtype, name, currency)
      values (${id}, ${m.group_id}, ${m.member_id}, 'asset', 'deposit', ${name}, ${m.base_currency})`
    const entryId = await postEntry(tx, m, {
      date, amount, sourceType: 'deposit_open',
      lines: [{ account: id, dir: 'debit' }, { account: from, dir: 'credit' }],
    })
    await tx`
      insert into deposit_settings (account_id, group_id, principal, annual_rate, days, withholding_rate, start_date,
                                    maturity_date, return_account_id, open_entry_id)
      values (${id}, ${m.group_id}, ${amount.toString()}, ${rate}, ${days}, ${withholding}, ${date},
              ${addDays(date, days)}, ${returnId ?? from}, ${entryId})`
    return { entry_id: entryId, account_id: id }
  })

  return result
}, 201)
