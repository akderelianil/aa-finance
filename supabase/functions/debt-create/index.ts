import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import {
  assertNotLocked, entryDate, findOrCreateContact, loadMember, parseAmount, postEntry, resolveAccount,
  resolveDebtAccount,
} from '../_shared/entries.ts'

// Kişiyle borç/alacak hareketi (hesap verilmezse nakit hesap):
//   lend    "Borç verdim"        Borç alacak(kişi) / Alacak hesap
//   collect "Alacağımı tahsil"   Borç hesap / Alacak alacak(kişi)
//   borrow  "Borç aldım"         Borç hesap / Alacak borç(kişi)
//   repay   "Borcumu ödedim"     Borç borç(kişi) / Alacak hesap
// due_date (isteğe bağlı, borç verme/alma): Yaklaşanlar'a vade planı. Ödeşme bakiyeyi sıfırlarsa açık planlar kapanır.
serve(async (req, user) => {
  const body = await readBody(req)
  const action = body.action
  if (action !== 'lend' && action !== 'collect' && action !== 'borrow' && action !== 'repay') {
    throw new HttpError(422, 'action geçersiz', 'invalid_action')
  }
  const contactName = requireString(body.contact_name, 'contact_name', 100)
  const accountId = typeof body.account_id === 'string' ? body.account_id : undefined
  const date = entryDate(body.date)
  const due = body.due_date === undefined || body.due_date === null || body.due_date === '' ? null : body.due_date
  if (due !== null && !(typeof due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(due) && due >= date
    && !isNaN(new Date(due + 'T00:00:00Z').getTime()))) {
    throw new HttpError(422, 'due_date geçersiz', 'invalid_due_date')
  }

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
    const eid = await postEntry(tx, m, { date, amount, sourceType: 'debt', lines })
    if (due && (action === 'lend' || action === 'borrow')) {
      await tx`
        insert into plans (id, group_id, member_id, kind, contact_id, due_date, source_entry_id)
        values (${uuidv7()}, ${m.group_id}, ${m.member_id}, 'debt_due', ${contactId}, ${due}, ${eid})`
    }
    if (action === 'collect' || action === 'repay') {
      const [bal] = await tx`
        select coalesce(sum(net_base_amount), 0)::bigint as net from contact_balances
        where member_id = ${m.member_id} and contact_id = ${contactId}`
      if (BigInt(bal.net) === 0n) {
        await tx`update plans set status = 'done', closed_at = now()
                 where member_id = ${m.member_id} and contact_id = ${contactId} and status = 'open'`
      }
    }
    return eid
  })

  return { entry_id: entryId }
}, 201)
