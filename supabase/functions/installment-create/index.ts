import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import {
  assertNotLocked, entryDate, findOrCreateCategory, loadMember, lockOwnAccount, parseAmount, postEntry,
} from '../_shared/entries.ts'

// Taksitli alışveriş (ana para birimi, kredi kartı): alışveriş günü tam tutar gider
// (Borç kategori / Alacak kart); taksitler beklenen ödemelerdir (installment-pay ile ödenir).
function addMonths(iso: string, n: number): string {
  const [y, mo, d] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(y, mo - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(d, last))
  return first.toISOString().slice(0, 10)
}

serve(async (req, user) => {
  const body = await readBody(req)
  const count = Number(body.installment_count)
  if (!Number.isInteger(count) || count < 2 || count > 36) throw new HttpError(422, 'installment_count geçersiz', 'invalid_count')
  const categoryName = requireString(body.category_name, 'category_name', 60)
  const description = body.description ? requireString(body.description, 'description', 200) : ''
  const date = entryDate(body.date)
  // İlk vade ileri tarihli olabilir; requireDate geleceği reddeder, bu yüzden kendi doğrulamamız.
  const firstDue = typeof body.first_due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.first_due_date)
    && !isNaN(new Date(body.first_due_date + 'T00:00:00Z').getTime()) ? body.first_due_date : null
  if (!firstDue || firstDue < date) throw new HttpError(422, 'first_due_date geçersiz', 'invalid_first_due_date')

  const planId = uuidv7()
  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    const card = await lockOwnAccount(tx, m.group_id, m.member_id, body.card_account_id)
    const [cs] = await tx`select subtype from accounts where id = ${card.id}`
    if (cs.subtype !== 'credit_card' || card.currency !== m.base_currency) {
      throw new HttpError(422, 'Taksit için ana para biriminde kredi kartı gerekli', 'invalid_account')
    }
    const total = parseAmount(body.total_amount, m.exponent)
    const catId = await findOrCreateCategory(tx, m.group_id, 'expense', categoryName)

    const eid = await postEntry(tx, m, {
      date, amount: total, description, sourceType: 'installment',
      lines: [{ account: catId, dir: 'debit' }, { account: card.id, dir: 'credit' }],
    })
    await tx`
      insert into installment_plans (id, group_id, member_id, purchase_entry_id, card_account_id, description,
                                     total_amount, currency, installment_count, first_due_date)
      values (${planId}, ${m.group_id}, ${m.member_id}, ${eid}, ${card.id}, ${description},
              ${total.toString()}, ${m.base_currency}, ${count}, ${firstDue})`
    const base = total / BigInt(count)
    const extra = Number(total % BigInt(count))
    for (let i = 0; i < count; i++) {
      const amt = base + (i < extra ? 1n : 0n)
      await tx`
        insert into installments (id, plan_id, seq, due_date, amount)
        values (${uuidv7()}, ${planId}, ${i + 1}, ${addMonths(firstDue, i)}, ${amt.toString()})`
    }
    return eid
  })

  return { plan_id: planId, entry_id: entryId }
}, 201)
