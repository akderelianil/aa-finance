import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import {
  assertNotLocked, entryDate, loadMember, parseAmount, postEntry, resolveAccount,
} from '../_shared/entries.ts'

// Kendi hesapların arası aktarım (kart ödemesi dahil): Borç hedef / Alacak kaynak.
// Bir taraf verilmezse üyenin nakit hesabıdır (ATM: çek = banka → nakit, yatır = nakit → banka).
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
    return postEntry(tx, m, {
      date, amount, sourceType: 'transfer',
      lines: [{ account: to, dir: 'debit' }, { account: from, dir: 'credit' }],
    })
  })

  return { entry_id: entryId }
}, 201)
