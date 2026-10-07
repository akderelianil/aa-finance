import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import {
  assertNotLocked, entryDate, findOrCreateContact, loadMember, parseAmount, postEntry, resolveAccount,
  resolveDebtAccount,
} from '../_shared/entries.ts'

// Kişiyle borç/alacak hareketi (hesap verilmezse nakit hesap):
//   lend    "Borç verdim"        Borç alacak(kişi) / Alacak hesap
//   collect "Alacağımı tahsil"   Borç hesap / Alacak alacak(kişi)
//   borrow  "Borç aldım"         Borç hesap / Alacak borç(kişi)
//   repay   "Borcumu ödedim"     Borç borç(kişi) / Alacak hesap
serve(async (req, user) => {
  const body = await readBody(req)
  const action = body.action
  if (action !== 'lend' && action !== 'collect' && action !== 'borrow' && action !== 'repay') {
    throw new HttpError(422, 'action geçersiz', 'invalid_action')
  }
  const contactName = requireString(body.contact_name, 'contact_name', 100)
  const accountId = typeof body.account_id === 'string' ? body.account_id : undefined
  const date = entryDate(body.date)

  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    const amount = parseAmount(body.amount, m.exponent)
    const acct = await resolveAccount(tx, m.group_id, m.member_id, m.base_currency, accountId)
    const contactId = await findOrCreateContact(tx, m.group_id, contactName)
    const debtAcct = await resolveDebtAccount(tx, m, action === 'lend' || action === 'collect' ? 'receivable' : 'payable')
    const lines = action === 'lend' || action === 'repay'
      ? [{ account: debtAcct, dir: 'debit' as const, contactId }, { account: acct, dir: 'credit' as const, contactId }]
      : [{ account: acct, dir: 'debit' as const, contactId }, { account: debtAcct, dir: 'credit' as const, contactId }]
    return postEntry(tx, m, { date, amount, sourceType: 'debt', lines })
  })

  return { entry_id: entryId }
}, 201)
