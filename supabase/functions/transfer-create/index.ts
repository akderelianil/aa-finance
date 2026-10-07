import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import {
  assertNotLocked, entryDate, loadMember, parseAmount, postEntry, resolveAccount,
} from '../_shared/entries.ts'

// Kendi hesapların arası aktarım (kart ödemesi dahil): Borç hedef / Alacak kaynak.
serve(async (req, user) => {
  const body = await readBody(req)
  if (typeof body.from_account_id !== 'string' || typeof body.to_account_id !== 'string') {
    throw new HttpError(422, 'account geçersiz', 'invalid_account')
  }
  if (body.from_account_id === body.to_account_id) throw new HttpError(422, 'Aynı hesap', 'same_account')
  const date = entryDate(body.date)

  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    const amount = parseAmount(body.amount, m.exponent)
    // Tutarlı kilit sırası için id sırasıyla kilitle (kilitlenme riski).
    const ids = [body.from_account_id as string, body.to_account_id as string].sort()
    const locked = new Map<string, string>()
    for (const id of ids) locked.set(id, await resolveAccount(tx, m.group_id, m.member_id, m.base_currency, id))
    return postEntry(tx, m, {
      date, amount, sourceType: 'transfer',
      lines: [
        { account: locked.get(body.to_account_id as string)!, dir: 'debit' },
        { account: locked.get(body.from_account_id as string)!, dir: 'credit' },
      ],
    })
  })

  return { entry_id: entryId }
}, 201)
