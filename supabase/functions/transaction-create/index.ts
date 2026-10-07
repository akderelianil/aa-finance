import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql, type Tx } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'

// Hızlı gider/gelir kaydı (ana para biriminde). Tek transaction, çift taraflı:
//   gider: Borç kategori / Alacak hesap     gelir: Borç hesap / Alacak kategori
// Opsiyonel/otomatik: tarih (bugün), hesap (üyenin nakit hesabı, yoksa açılır),
// kategori ve kişi (isimle bulunur, yoksa açılır).
const MAX_MINOR = 10n ** 15n

function parseAmount(v: unknown, exponent: number): bigint {
  const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
  const m = /^(\d{1,15})(?:\.(\d+))?$/.exec(s)
  if (!m || (m[2]?.length ?? 0) > exponent) throw new HttpError(422, 'amount geçersiz', 'invalid_amount')
  const minor = BigInt(m[1] + (m[2] ?? '').padEnd(exponent, '0'))
  if (minor <= 0n || minor >= MAX_MINOR) throw new HttpError(422, 'amount geçersiz', 'invalid_amount')
  return minor
}

// İstemci saat dilimi UTC'den ileride olabilir; bir gün tolerans.
function entryDate(v: unknown): string {
  const today = new Date().toISOString().slice(0, 10)
  if (v === undefined || v === null || v === '') return today
  const s = typeof v === 'string' ? v : ''
  const d = new Date(s + 'T00:00:00Z')
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(d.getTime()) && d.toISOString().startsWith(s)
  if (!valid || s < '2000-01-01' || d.getTime() > Date.now() + 86_400_000) {
    throw new HttpError(422, 'date geçersiz', 'invalid_date')
  }
  return s
}

async function findOrCreateCategory(tx: Tx, groupId: string, type: string, name: string) {
  const [found] = await tx`
    select id from accounts
    where group_id = ${groupId} and type = ${type} and system_key is null and archived_at is null
      and not is_placeholder and lower(name) = lower(${name})
    order by created_at limit 1`
  if (found) return found.id as string
  const id = uuidv7()
  await tx`insert into accounts (id, group_id, type, name) values (${id}, ${groupId}, ${type}, ${name})`
  return id
}

async function findOrCreateContact(tx: Tx, groupId: string, name: string) {
  const [found] = await tx`
    select id from contacts
    where group_id = ${groupId} and archived_at is null and lower(name) = lower(${name})
    order by created_at limit 1`
  if (found) return found.id as string
  const id = uuidv7()
  await tx`insert into contacts (id, group_id, name) values (${id}, ${groupId}, ${name})`
  return id
}

// Hesap verilmediyse üyenin ana para birimindeki ilk nakit hesabı; yoksa "Nakit" açılır.
async function resolveAccount(tx: Tx, groupId: string, memberId: string, currency: string, accountId?: string) {
  if (accountId) {
    const [acc] = await tx`
      select id, currency from accounts
      where id = ${accountId} and group_id = ${groupId} and owner_member_id = ${memberId}
        and type in ('asset', 'liability') and not is_placeholder and archived_at is null
      for update`
    if (!acc) throw new HttpError(422, 'account geçersiz', 'invalid_account')
    if (acc.currency !== currency) throw new HttpError(422, 'Hesap para birimi uyumsuz', 'currency_mismatch')
    return acc.id as string
  }
  const [cash] = await tx`
    select id from accounts
    where group_id = ${groupId} and owner_member_id = ${memberId} and subtype = 'cash'
      and currency = ${currency} and not is_placeholder and archived_at is null
    order by created_at limit 1
    for update`
  if (cash) return cash.id as string
  const id = uuidv7()
  await tx`
    insert into accounts (id, group_id, owner_member_id, type, subtype, name, currency)
    values (${id}, ${groupId}, ${memberId}, 'asset', 'cash', 'Nakit', ${currency})`
  return id
}

serve(async (req, user) => {
  const body = await readBody(req)
  const kind = body.kind
  if (kind !== 'expense' && kind !== 'income') throw new HttpError(422, 'kind geçersiz', 'invalid_kind')
  const categoryName = requireString(body.category_name, 'category_name', 60)
  const contactName = body.contact_name ? requireString(body.contact_name, 'contact_name', 100) : null
  const description = body.description ? requireString(body.description, 'description', 200) : ''
  const accountId = typeof body.account_id === 'string' ? body.account_id : undefined
  const date = entryDate(body.date)

  const entryId = uuidv7()

  await sql.begin(async (tx) => {
    const [m] = await tx`
      select m.id as member_id, m.group_id, g.base_currency, g.lock_date, c.exponent
      from members m
      join groups g on g.id = m.group_id
      join currencies c on c.code = g.base_currency
      where m.user_id = ${user.id}`
    if (!m) throw new HttpError(403, 'Bir gruba üye değilsin', 'not_member')
    await setActor(tx, m.member_id)
    if (m.lock_date && date <= m.lock_date) throw new HttpError(422, 'Bu dönem kilitli', 'period_locked')

    const amount = parseAmount(body.amount, m.exponent)
    const currency = m.base_currency as string
    const acctId = await resolveAccount(tx, m.group_id, m.member_id, currency, accountId)
    const catId = await findOrCreateCategory(tx, m.group_id, kind, categoryName)
    const contactId = contactName ? await findOrCreateContact(tx, m.group_id, contactName) : null

    await tx`
      insert into journal_entries (id, group_id, member_id, created_by, entry_date, description)
      values (${entryId}, ${m.group_id}, ${m.member_id}, ${m.member_id}, ${date}, ${description})`

    const lines = kind === 'expense'
      ? [{ account: catId, dir: 'debit' }, { account: acctId, dir: 'credit' }]
      : [{ account: acctId, dir: 'debit' }, { account: catId, dir: 'credit' }]
    for (const [i, l] of lines.entries()) {
      await tx`
        insert into journal_lines (id, entry_id, account_id, contact_id, direction, amount, currency, base_amount, fx_rate, position)
        values (${uuidv7()}, ${entryId}, ${l.account}, ${contactId}, ${l.dir}, ${amount.toString()}, ${currency},
                ${amount.toString()}, 1, ${i})`
    }
  })

  return { entry_id: entryId }
}, 201)
