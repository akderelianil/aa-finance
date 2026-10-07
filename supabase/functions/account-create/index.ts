import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import { loadMember, parseAmount, postRawEntry } from '../_shared/entries.ts'
import { exponentOf, parseRate, resolveRate, saveRate, toBase } from '../_shared/fx.ts'

// Kullanıcının kendi hesabı: nakit, banka, kredi kartı, kredi/borç.
// Para birimi varsayılan grubun ana para birimi; döviz hesabında başlangıç bakiyesi için kur (verilmezse son kur) gerekir.
// Başlangıç bakiyesi (kartta: mevcut borç) opsiyonel.
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
    const exp = await exponentOf(tx, currency)

    await tx`
      insert into accounts (id, group_id, owner_member_id, type, subtype, name, currency)
      values (${id}, ${m.group_id}, ${m.member_id}, ${type}, ${subtype}, ${name}, ${currency})`

    if (body.opening_balance !== undefined && body.opening_balance !== '' && body.opening_balance !== null) {
      const amount = parseAmount(body.opening_balance, exp)
      let base = amount
      let rate: string | undefined
      if (currency !== m.base_currency) {
        const given = parseRate(body.rate)
        rate = await resolveRate(tx, m.group_id, currency, m.base_currency, given)
        base = await toBase(tx, amount, exp, m.exponent, rate)
        if (given) await saveRate(tx, m.group_id, currency, m.base_currency, new Date().toISOString().slice(0, 10), given)
      }
      const [eq] = await tx`
        select id from accounts
        where group_id = ${m.group_id} and owner_member_id = ${m.member_id} and system_key = 'opening_balance'
        for update`
      if (!eq) throw new Error('opening_balance account missing for member ' + m.member_id)
      // Varlık: Borç hesap / Alacak açılış. Borç hesabı: Borç açılış / Alacak hesap.
      const acct = { amount, currency, base, rate }
      const eqLine = { amount: base, currency: m.base_currency, base }
      await postRawEntry(tx, m, {
        date: new Date().toISOString().slice(0, 10), description: name, sourceType: 'opening_balance',
        lines: type === 'asset'
          ? [{ account: id, dir: 'debit', ...acct }, { account: eq.id, dir: 'credit', ...eqLine }]
          : [{ account: eq.id, dir: 'debit', ...eqLine }, { account: id, dir: 'credit', ...acct }],
      })
    }
  })

  return { account_id: id }
}, 201)
