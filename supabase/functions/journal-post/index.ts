import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql, type Tx } from '../_shared/db.ts'
import {
  assertNotLocked, entryDate, insertLines, loadMember, loadOwnedEntry, parseAmount, parseTags, postRawEntry, setEntryTags,
  softDeleteEntry,
  type RawLine,
} from '../_shared/entries.ts'
import { dayRate, parseRate, saveRate, toBase } from '../_shared/fx.ts'

// General Journal write: create, update or delete one journal entry from a line list (GnuCash splits).
// Request: { action: 'create' | 'update' | 'delete', entry_id?, date?, description?,
//            tags?: string[], lines: [{ account_id, side: 'debit' | 'credit', amount, rate?, base_amount?, memo?, contact_id? }] }
// tags: names; new names open as group tags. On update, omitted tags keep the current ones.
// contact_id tags a line with a Rehber contact of the group (receivable/payable balance, who was paid).
// amount is in the account currency. For a foreign-currency line the base amount comes from base_amount, else
// from rate, else from the day rate (saved rate, TCMB, last saved). Total debit = total credit in base_amount.

// Entries of hidden flows with link tables (installment, deposit, loan, investment) are edited in their flow.
const LINKED = ['installment', 'installment_payment', 'deposit', 'deposit_open', 'loan', 'investment']

type Member = Awaited<ReturnType<typeof loadMember>>

serve(async (req, user) => {
  const body = await readBody(req)
  const action = body.action ?? 'create'
  if (action !== 'create' && action !== 'update' && action !== 'delete') {
    throw new HttpError(422, 'action geçersiz', 'invalid_action')
  }

  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)

    if (action === 'delete') {
      const entry = await loadOwnedEntry(tx, body.entry_id, m)
      await softDeleteEntry(tx, entry.id, m.member_id)
      return entry.id
    }

    let existing: string | null = null
    if (action === 'update') {
      const entry = await loadOwnedEntry(tx, body.entry_id, m)
      const [src] = await tx`select source_type from journal_entries where id = ${entry.id}`
      if (LINKED.includes(src.source_type as string)) {
        throw new HttpError(422, 'Bu kayıt türü henüz düzenlenemiyor', 'unsupported_entry')
      }
      existing = entry.id
    }

    const date = entryDate(body.date)
    assertNotLocked(m.lock_date, date)
    const description = body.description ? requireString(body.description, 'description', 200) : ''
    const lines = await parseLines(tx, m, date, body.lines)
    const tags = parseTags(body.tags)

    if (existing) {
      await tx`update journal_entries set entry_date = ${date}, description = ${description}, updated_at = now()
               where id = ${existing}`
      await tx`delete from journal_lines where entry_id = ${existing}`
      await insertLines(tx, existing, lines)
      if (body.tags !== undefined) await setEntryTags(tx, m.group_id, existing, tags)
      return existing
    }
    return await postRawEntry(tx, m, { date, description, lines, tags })
  })

  return { entry_id: entryId }
})

async function parseLines(tx: Tx, m: Member, date: string, v: unknown): Promise<RawLine[]> {
  if (!Array.isArray(v) || v.length < 2 || v.length > 100) throw new HttpError(422, 'lines geçersiz', 'invalid_lines')
  const raw = v.map((l) => (l && typeof l === 'object' ? l : {}) as Record<string, unknown>)
  const ids = [...new Set(raw.map((l) => l.account_id))]
  if (ids.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
    throw new HttpError(422, 'account geçersiz', 'invalid_account')
  }

  // Lock the line accounts in id order (no deadlock between two writers).
  const rows = await tx`
    select a.id, a.currency, a.is_placeholder, a.archived_at, c.exponent
    from accounts a join currencies c on c.code = a.currency
    where a.group_id = ${m.group_id} and a.id = any(${ids as string[]}::uuid[])
    order by a.id for update of a`
  const accounts = new Map(rows.map((r) => [r.id as string, r]))

  const contactIds = [...new Set(raw.map((l) => l.contact_id).filter((c) => c !== undefined && c !== null && c !== ''))]
  if (contactIds.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
    throw new HttpError(422, 'contact geçersiz', 'invalid_contact')
  }
  if (contactIds.length) {
    const found = await tx`
      select id from contacts where group_id = ${m.group_id} and id = any(${contactIds as string[]}::uuid[])`
    if (found.length !== contactIds.length) throw new HttpError(422, 'contact geçersiz', 'invalid_contact')
  }

  const out: RawLine[] = []
  let debit = 0n
  let credit = 0n
  for (const l of raw) {
    const acc = accounts.get(l.account_id as string)
    if (!acc || acc.archived_at) throw new HttpError(422, 'account geçersiz', 'invalid_account')
    if (acc.is_placeholder) throw new HttpError(422, 'Grup hesabına kayıt yapılamaz', 'placeholder_account')
    if (l.side !== 'debit' && l.side !== 'credit') throw new HttpError(422, 'side geçersiz', 'invalid_side')
    const currency = acc.currency as string
    const exp = acc.exponent as number
    const amount = parseAmount(l.amount, exp)
    let base = amount
    let rate = '1'
    if (currency !== m.base_currency) {
      if (l.base_amount !== undefined && l.base_amount !== null && l.base_amount !== '') {
        base = parseAmount(l.base_amount, m.exponent)
        const [r] = await tx`
          select round(${base.toString()}::numeric * power(10::numeric, ${exp})
                       / (${amount.toString()}::numeric * power(10::numeric, ${m.exponent})), 10)::text as v`
        rate = r.v as string
      } else {
        const given = parseRate(l.rate)
        rate = given ?? await dayRate(tx, m.group_id, currency, m.base_currency, date)
        if (given) await saveRate(tx, m.group_id, currency, m.base_currency, date, given)
        base = await toBase(tx, amount, exp, m.exponent, rate)
      }
    }
    const memo = l.memo ? requireString(l.memo, 'memo', 200) : null
    if (l.side === 'debit') debit += base
    else credit += base
    const contactId = typeof l.contact_id === 'string' && l.contact_id ? l.contact_id : null
    out.push({ account: acc.id as string, dir: l.side, amount, currency, base, rate, memo, contactId })
  }
  if (debit !== credit) {
    throw new HttpError(422, `Borç (${debit}) ve alacak (${credit}) toplamı eşit değil`, 'unbalanced')
  }
  return out
}
