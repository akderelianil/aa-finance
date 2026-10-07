import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import {
  assertNotLocked, entryDate, findOrCreateCategory, findOrCreateContact, learnBrandCategory, loadMember, lockOwnAccount, parseAmount,
  postRawEntry, type RawLine,
} from '../_shared/entries.ts'
import { parseSplit, splitDebitLines } from '../_shared/split.ts'

// Taksitli alışveriş (ana para birimi, kredi kartı): alışveriş günü tam tutar gider
// (Borç kategori / Alacak kart); taksit takvimi yalnız gösterimdir. `split` verilirse paylaştırılır.
// İlk taksit tarihi verilmezse kartın kesim/son ödeme gününden türetilir, o da yoksa bir ay sonrası.
function addMonths(iso: string, n: number): string {
  const [y, mo, d] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(y, mo - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(d, last))
  return first.toISOString().slice(0, 10)
}

// İlk taksitin son ödeme günü: alışverişten sonraki ilk kesim (S), S'den sonraki ilk son ödeme günü.
// Kesim günü yoksa S = alışveriş günü; son ödeme günü yoksa bir ay sonrası.
function firstDueDate(purchase: string, statementDay: number | null, dueDay: number | null): string {
  if (!dueDay) return addMonths(purchase, 1)
  const month = purchase.slice(0, 8) // "YYYY-MM-"
  const dayIn = (m: string, day: number) => clampDay(`${m}${String(day).padStart(2, '0')}`)
  let stmt = purchase
  if (statementDay) {
    stmt = dayIn(month, statementDay)
    if (stmt < purchase) stmt = dayIn(addMonths(`${month}01`, 1).slice(0, 8), statementDay)
  }
  const due = dayIn(stmt.slice(0, 8), dueDay)
  return due > stmt ? due : dayIn(addMonths(`${stmt.slice(0, 8)}01`, 1).slice(0, 8), dueDay)
}

// "2026-02-31" → ayın son günü.
function clampDay(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number)
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return `${iso.slice(0, 8)}${String(Math.min(d, last)).padStart(2, '0')}`
}

serve(async (req, user) => {
  const body = await readBody(req)
  const count = Number(body.installment_count)
  if (!Number.isInteger(count) || count < 2 || count > 36) throw new HttpError(422, 'installment_count geçersiz', 'invalid_count')
  const categoryName = requireString(body.category_name, 'category_name', 60)
  const description = body.description ? requireString(body.description, 'description', 200) : ''
  const contactName = body.contact_name ? requireString(body.contact_name, 'contact_name', 100) : null
  const split = parseSplit(body.split)
  const date = entryDate(body.date)
  // İlk vade ileri tarihli olabilir; requireDate geleceği reddeder, bu yüzden kendi doğrulamamız.
  const givenDue = body.first_due_date === undefined || body.first_due_date === null || body.first_due_date === ''
    ? null : body.first_due_date
  if (givenDue !== null && !(typeof givenDue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(givenDue)
    && !isNaN(new Date(givenDue + 'T00:00:00Z').getTime()) && givenDue >= date)) {
    throw new HttpError(422, 'first_due_date geçersiz', 'invalid_first_due_date')
  }

  const planId = uuidv7()
  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    const card = await lockOwnAccount(tx, m.group_id, m.member_id, body.card_account_id)
    const [cs] = await tx`
      select a.subtype, s.statement_day, s.due_day
      from accounts a left join credit_card_settings s on s.account_id = a.id where a.id = ${card.id}`
    if (cs.subtype !== 'credit_card' || card.currency !== m.base_currency) {
      throw new HttpError(422, 'Taksit için ana para biriminde kredi kartı gerekli', 'invalid_account')
    }
    const firstDue = givenDue ?? firstDueDate(date, cs.statement_day, cs.due_day)
    const total = parseAmount(body.total_amount, m.exponent)
    const catId = await findOrCreateCategory(tx, m.group_id, 'expense', categoryName)
    const contactId = contactName ? await findOrCreateContact(tx, m.group_id, contactName, 'brand') : null
    await learnBrandCategory(tx, contactId, catId)
    const cur = m.base_currency
    const lines: RawLine[] = split
      ? await splitDebitLines(tx, m, catId, total, split, contactId)
      : [{ account: catId, dir: 'debit', amount: total, currency: cur, base: total, contactId }]
    lines.push({ account: card.id, dir: 'credit', amount: total, currency: cur, base: total, contactId })

    const eid = await postRawEntry(tx, m, { date, description, sourceType: 'installment', lines })
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
