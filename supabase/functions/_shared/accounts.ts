import { Tx } from './db.ts'
import { HttpError } from './http.ts'
import { uuidv7 } from './uuid.ts'

// Group system accounts (income): 645 and 646 under 64 (codes from trigger accounts_defaults).
export async function createGroupSystemAccounts(tx: Tx, groupId: string) {
  await tx`
    insert into accounts (id, group_id, type, name, system_key) values
      (${uuidv7()}, ${groupId}, 'income', 'Kambiyo Kâr/Zararları', 'fx_gain_loss'),
      (${uuidv7()}, ${groupId}, 'income', 'Menkul Kıymet Satış Kâr/Zararları', 'investment_gain_loss')`
}

// Hazır kategori ağacı ve marka → kategori eşleşmeleri (migration 20261008040000).
export async function applyAccountTemplate(tx: Tx, groupId: string) {
  await tx`select apply_account_template(${groupId})`
}

// Yeni üyenin başlangıç hesapları: açılış bakiyesi (özkaynak) ve cüzdan ("Nakit"); grubun ana para biriminde.
export async function createMemberAccounts(
  tx: Tx,
  groupId: string,
  memberId: string,
  currency: string,
) {
  await tx`
    insert into accounts (id, group_id, owner_member_id, type, subtype, name, currency, system_key) values
      (${uuidv7()}, ${groupId}, ${memberId}, 'equity', null, 'Açılış Bakiyesi', ${currency}, 'opening_balance'),
      (${uuidv7()}, ${groupId}, ${memberId}, 'asset', 'cash', 'Nakit', ${currency}, null)`
}

// Kredi kartı kesim / son ödeme günü (kart başına bir kez; Yaklaşanlar buradan türer). Alan verilmezse dokunulmaz.
export async function saveCardDays(tx: Tx, accountId: string, body: Record<string, unknown>) {
  if (body.statement_day === undefined && body.due_day === undefined) return
  const day = (v: unknown) => {
    if (v === null || v === '' || v === undefined) return null
    const n = Number(v)
    if (!Number.isInteger(n) || n < 1 || n > 31) throw new HttpError(422, 'Gün geçersiz', 'invalid_day')
    return n
  }
  const statement = day(body.statement_day)
  const due = day(body.due_day)
  await tx`
    insert into credit_card_settings (account_id, statement_day, due_day) values (${accountId}, ${statement}, ${due})
    on conflict (account_id) do update set statement_day = excluded.statement_day, due_day = excluded.due_day`
}

// GnuCash account kinds per type (accounts.subtype). null = the plain type.
const SUBTYPES: Record<string, string[]> = {
  asset: ['cash', 'bank', 'deposit', 'investment', 'receivable', 'other'],
  liability: ['credit_card', 'loan', 'payable', 'other'],
  equity: [], income: [], expense: [],
}

// Optional account fields of account-create / account-update. undefined = not given, null = clear.
export async function parseAccountFields(tx: Tx, groupId: string, type: string, body: Record<string, unknown>) {
  let code: string | undefined
  if (body.code !== undefined && body.code !== null && body.code !== '') {
    code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!/^[0-9]+(\.[0-9]+)*$/.test(code) || code.length > 30) throw new HttpError(422, 'code geçersiz', 'invalid_account_code')
    const [dup] = await tx`select 1 from accounts where group_id = ${groupId} and code = ${code} and id <> ${
      (body.account_id as string | undefined) ?? '00000000-0000-0000-0000-000000000000'}`
    if (dup) throw new HttpError(409, 'Bu hesap kodu kullanılıyor', 'duplicate_code')
  }
  let currency: string | undefined
  if (body.currency !== undefined && body.currency !== null && body.currency !== '') {
    currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : ''
    const [c] = await tx`select 1 from currencies where code = ${currency}`
    if (!c) throw new HttpError(422, 'currency geçersiz', 'invalid_currency')
  }
  let subtype: string | null | undefined
  if (body.subtype !== undefined) {
    subtype = body.subtype === null || body.subtype === '' ? null : String(body.subtype)
    if (subtype !== null && !SUBTYPES[type]?.includes(subtype)) throw new HttpError(422, 'subtype geçersiz', 'invalid_subtype')
  }
  let owner: string | null | undefined
  if (body.owner_member_id !== undefined) {
    owner = body.owner_member_id === null || body.owner_member_id === '' ? null : String(body.owner_member_id)
    if (owner !== null) {
      const valid = /^[0-9a-f-]{36}$/i.test(owner)
      const [mm] = valid ? await tx`select 1 from members where id = ${owner} and group_id = ${groupId}` : []
      if (!mm) throw new HttpError(422, 'owner geçersiz', 'invalid_owner')
    }
  }
  return { code, currency, subtype, owner }
}
