import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import {
  assertNotLocked, entryDate, findOrCreateCategory, findTemplateCategory, loadMember, parseAmount, postRawEntry, resolveAccount,
} from '../_shared/entries.ts'

// Kendi hesapların arası aktarım (kart ödemesi dahil): Borç hedef / Alacak kaynak.
// Bir taraf verilmezse üyenin nakit hesabıdır (ATM: çek = banka → nakit, yatır = nakit → banka).
// Nakit avans: kaynak kredi kartı. `fee` (isteğe bağlı komisyon) gider olur ve kart borcuna eklenir:
//   Borç hedef (tutar) + Borç masraf (komisyon) / Alacak kart (tutar + komisyon)
serve(async (req, user) => {
  const body = await readBody(req)
  const fromId = typeof body.from_account_id === 'string' && body.from_account_id ? body.from_account_id : undefined
  const toId = typeof body.to_account_id === 'string' && body.to_account_id ? body.to_account_id : undefined
  if (!fromId && !toId) throw new HttpError(422, 'account geçersiz', 'invalid_account')
  const date = entryDate(body.date)

  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    const amount = parseAmount(body.amount, m.exponent)
    // Tutarlı kilit sırası için id sırasıyla kilitle (kilitlenme riski); nakit (boş) en sonda.
    const ids = [fromId, toId].filter((id): id is string => !!id).sort()
    const locked = new Map<string | undefined, string>()
    for (const id of ids) locked.set(id, await resolveAccount(tx, m.group_id, m.member_id, m.base_currency, id))
    if (ids.length === 1) locked.set(undefined, await resolveAccount(tx, m.group_id, m.member_id, m.base_currency))
    const from = locked.get(fromId)!
    const to = locked.get(toId)!
    if (from === to) throw new HttpError(422, 'Aynı hesap', 'same_account')
    const [src] = await tx`select subtype from accounts where id = ${from}`
    const toCash = !toId
    const advance = src.subtype === 'credit_card' && toCash
    const fee = body.fee === undefined || body.fee === null || body.fee === '' ? 0n : parseAmount(body.fee, m.exponent)
    if (fee > 0n && !advance) throw new HttpError(422, 'Komisyon yalnız nakit avansta', 'invalid_fee')
    const cur = m.base_currency
    const lines = [
      { account: to, dir: 'debit' as const, amount, currency: cur, base: amount },
      { account: from, dir: 'credit' as const, amount: amount + fee, currency: cur, base: amount + fee },
    ]
    if (fee > 0n) {
      const feeName = typeof body.fee_category_name === 'string' ? body.fee_category_name.trim().slice(0, 60) : ''
      const feeCat = feeName
        ? await findOrCreateCategory(tx, m.group_id, 'expense', feeName)
        : await findTemplateCategory(tx, m.group_id, 'cash_advance_fee', 'expense', 'Nakit Avans Masrafı')
      lines.splice(1, 0, { account: feeCat, dir: 'debit', amount: fee, currency: cur, base: fee })
    }
    return postRawEntry(tx, m, { date, sourceType: advance ? 'cash_advance' : 'transfer', lines })
  })

  return { entry_id: entryId }
}, 201)
