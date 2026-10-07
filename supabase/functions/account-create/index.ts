import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import { loadMember, parseAmount } from '../_shared/entries.ts'

// Kullanıcının kendi hesabı: nakit, banka, kredi kartı, kredi/borç.
// Şimdilik yalnız grubun ana para biriminde. Başlangıç bakiyesi (kartta: mevcut borç) opsiyonel.
const SUBTYPES: Record<string, 'asset' | 'liability'> = {
  cash: 'asset', bank: 'asset', credit_card: 'liability', loan: 'liability',
}

serve(async (req, user) => {
  const body = await readBody(req)
  const name = requireString(body.name, 'name', 60)
  const subtype = typeof body.subtype === 'string' ? body.subtype : ''
  const type = SUBTYPES[subtype]
  if (!type) throw new HttpError(422, 'subtype geçersiz', 'invalid_subtype')

  const id = uuidv7()

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const currency = body.currency ? requireString(body.currency, 'currency', 3).toUpperCase() : m.base_currency
    if (currency !== m.base_currency) throw new HttpError(422, 'Şimdilik yalnız ana para birimi', 'currency_mismatch')

    await tx`
      insert into accounts (id, group_id, owner_member_id, type, subtype, name, currency)
      values (${id}, ${m.group_id}, ${m.member_id}, ${type}, ${subtype}, ${name}, ${currency})`

    if (body.opening_balance !== undefined && body.opening_balance !== '' && body.opening_balance !== null) {
      const amount = parseAmount(body.opening_balance, m.exponent).toString()
      const [eq] = await tx`
        select id from accounts
        where group_id = ${m.group_id} and owner_member_id = ${m.member_id} and system_key = 'opening_balance'
        for update`
      if (!eq) throw new Error('opening_balance account missing for member ' + m.member_id)
      const entryId = uuidv7()
      await tx`
        insert into journal_entries (id, group_id, member_id, created_by, entry_date, description, source_type)
        values (${entryId}, ${m.group_id}, ${m.member_id}, ${m.member_id}, current_date, ${name}, 'opening_balance')`
      // Varlık: Borç hesap / Alacak açılış. Borç hesabı: Borç açılış / Alacak hesap.
      const lines = type === 'asset'
        ? [{ a: id, d: 'debit' }, { a: eq.id, d: 'credit' }]
        : [{ a: eq.id, d: 'debit' }, { a: id, d: 'credit' }]
      for (const [i, l] of lines.entries()) {
        await tx`
          insert into journal_lines (id, entry_id, account_id, direction, amount, currency, base_amount, fx_rate, position)
          values (${uuidv7()}, ${entryId}, ${l.a}, ${l.d}, ${amount}, ${currency}, ${amount}, 1, ${i})`
      }
    }
  })

  return { account_id: id }
}, 201)
