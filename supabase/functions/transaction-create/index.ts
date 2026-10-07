import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql, type Tx } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import {
  assertNotLocked, entryDate, findOrCreateCategory, findOrCreateContact, loadMember, parseAmount,
} from '../_shared/entries.ts'

// Hızlı gider/gelir kaydı (ana para biriminde). Tek transaction, çift taraflı:
//   gider: Borç kategori / Alacak hesap     gelir: Borç hesap / Alacak kategori
// Opsiyonel/otomatik: tarih (bugün), hesap (üyenin nakit hesabı, yoksa açılır),
// kategori ve kişi (isimle bulunur, yoksa açılır).

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
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)

    const amount = parseAmount(body.amount, m.exponent)
    const currency = m.base_currency
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
