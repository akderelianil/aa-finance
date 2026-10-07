import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import {
  assertNotLocked, entryDate, parseTags, findOrCreateContact, findTemplateCategory, loadMember, parseAmount, postRawEntry,
  resolveAccount, type RawLine,
} from '../_shared/entries.ts'

// Banka kredisi (Borç → Aldım → bankadan). Karar 2026-10-07: toplam geri ödeme kredi günü borçtur.
//   Borç hesap (yatan net) + Borç "Kredi Masrafı" (anlaşılan − yatan) + Borç "Kredi Maliyeti" (toplam − anlaşılan)
//   / Alacak kredi hesabı (toplam geri ödeme)
// Türetilen: anlaşılan = yatan, toplam = taksit sayısı × taksit tutarı, ilk taksit = bir ay sonra, kredi hesabı açılır.
function addMonths(iso: string, n: number): string {
  const [y, mo, d] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(y, mo - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(d, last))
  return first.toISOString().slice(0, 10)
}

const given = (v: unknown) => v !== undefined && v !== null && v !== ''

serve(async (req, user) => {
  const body = await readBody(req)
  const lender = requireString(body.lender_name, 'lender_name', 100)
  const count = Number(body.installment_count)
  if (!Number.isInteger(count) || count < 1 || count > 120) throw new HttpError(422, 'installment_count geçersiz', 'invalid_count')
  const date = entryDate(body.date)
  const tags = parseTags(body.tags)
  const firstDue = given(body.first_due_date) ? body.first_due_date : addMonths(date, 1)
  if (!(typeof firstDue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(firstDue) && firstDue > date
    && !isNaN(new Date(firstDue + 'T00:00:00Z').getTime()))) {
    throw new HttpError(422, 'first_due_date geçersiz', 'invalid_first_due_date')
  }
  const accountId = typeof body.account_id === 'string' && body.account_id ? body.account_id : undefined

  const result = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    const received = parseAmount(body.amount, m.exponent)
    const installment = parseAmount(body.installment_amount, m.exponent)
    const principal = given(body.principal) ? parseAmount(body.principal, m.exponent) : received
    const total = given(body.total_repayment) ? parseAmount(body.total_repayment, m.exponent) : installment * BigInt(count)
    if (principal < received) throw new HttpError(422, 'Anlaşılan tutar yatan tutardan küçük olamaz', 'invalid_principal')
    if (total < principal) throw new HttpError(422, 'Toplam geri ödeme anlaşılan tutardan küçük olamaz', 'invalid_total')

    const target = await resolveAccount(tx, m.group_id, m.member_id, m.base_currency, accountId)
    const lenderId = await findOrCreateContact(tx, m.group_id, lender, 'brand')
    const loanId = uuidv7()
    await tx`
      insert into accounts (id, group_id, owner_member_id, type, subtype, name, currency)
      values (${loanId}, ${m.group_id}, ${m.member_id}, 'liability', 'loan', ${`${lender} kredisi`.slice(0, 60)}, ${m.base_currency})`

    const cur = m.base_currency
    const line = (account: string, dir: 'debit' | 'credit', amt: bigint): RawLine =>
      ({ account, dir, amount: amt, currency: cur, base: amt, contactId: lenderId })
    const lines: RawLine[] = [line(target, 'debit', received)]
    if (principal > received) lines.push(line(await findTemplateCategory(tx, m.group_id, 'loan_fee', 'expense', 'Kredi Masrafı'), 'debit', principal - received))
    if (total > principal) lines.push(line(await findTemplateCategory(tx, m.group_id, 'loan_cost', 'expense', 'Kredi Maliyeti'), 'debit', total - principal))
    lines.push(line(loanId, 'credit', total))

    const entryId = await postRawEntry(tx, m, { date, description: `${lender} kredisi`, sourceType: 'loan', lines, tags })
    await tx`
      insert into loan_settings (account_id, group_id, lender_contact_id, principal, total_repayment, installment_count,
                                 installment_amount, first_due_date, source_entry_id)
      values (${loanId}, ${m.group_id}, ${lenderId}, ${principal.toString()}, ${total.toString()}, ${count},
              ${installment.toString()}, ${firstDue}, ${entryId})`
    return { entry_id: entryId, account_id: loanId }
  })

  return result
}, 201)
