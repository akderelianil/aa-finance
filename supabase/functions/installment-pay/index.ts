import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { assertNotLocked, entryDate, loadMember, postEntry, resolveAccount } from '../_shared/entries.ts'

// Taksit ödemesi: Borç kart / Alacak ödeme hesabı (verilmezse nakit hesap). Taksiti ödenmiş işaretler.
serve(async (req, user) => {
  const body = await readBody(req)
  if (typeof body.installment_id !== 'string') throw new HttpError(422, 'installment_id geçersiz', 'invalid_installment')
  const date = entryDate(body.date)
  const accountId = typeof body.account_id === 'string' ? body.account_id : undefined

  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    const [i] = await tx`
      select i.id, i.amount::text as amount, i.payment_entry_id, p.member_id, p.card_account_id
      from installments i join installment_plans p on p.id = i.plan_id
      where i.id = ${body.installment_id as string} for update of i`
    if (!i) throw new HttpError(404, 'Taksit bulunamadı', 'not_found')
    if (i.member_id !== m.member_id) throw new HttpError(403, 'Bu taksit sana ait değil', 'not_owner')
    if (i.payment_entry_id) throw new HttpError(409, 'Taksit zaten ödenmiş', 'already_paid')
    const pay = await resolveAccount(tx, m.group_id, m.member_id, m.base_currency, accountId)
    const eid = await postEntry(tx, m, {
      date, amount: BigInt(i.amount), sourceType: 'installment_payment',
      lines: [{ account: i.card_account_id, dir: 'debit' }, { account: pay, dir: 'credit' }],
    })
    await tx`update installments set payment_entry_id = ${eid} where id = ${i.id}`
    return eid
  })

  return { entry_id: entryId }
}, 201)
