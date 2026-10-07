import { HttpError } from './http.ts'
import type { Tx } from './db.ts'
import { uuidv7 } from './uuid.ts'

const MAX_MINOR = 10n ** 15n

// Ondalık string → minor unit (bigint). Float yok.
export function parseAmount(v: unknown, exponent: number): bigint {
  const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : ''
  const m = /^(\d{1,15})(?:\.(\d+))?$/.exec(s)
  if (!m || (m[2]?.length ?? 0) > exponent) throw new HttpError(422, 'amount geçersiz', 'invalid_amount')
  const minor = BigInt(m[1] + (m[2] ?? '').padEnd(exponent, '0'))
  if (minor <= 0n || minor >= MAX_MINOR) throw new HttpError(422, 'amount geçersiz', 'invalid_amount')
  return minor
}

// İstemci saat dilimi UTC'den ileride olabilir; bir gün tolerans.
export function entryDate(v: unknown): string {
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

export function assertNotLocked(lockDate: string | null, date: string) {
  if (lockDate && date <= lockDate) throw new HttpError(422, 'Bu dönem kilitli', 'period_locked')
}

export async function findOrCreateCategory(tx: Tx, groupId: string, type: string, name: string) {
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

// Rehber kaydı isimle bulunur; yoksa bağlama göre türle açılır (gider/gelir: marka, borç/paylaşım: kişi).
export async function findOrCreateContact(
  tx: Tx, groupId: string, name: string, kind: 'individual' | 'brand' = 'individual',
) {
  const [found] = await tx`
    select id from contacts
    where group_id = ${groupId} and archived_at is null and lower(name) = lower(${name})
    order by created_at limit 1`
  if (found) return found.id as string
  const id = uuidv7()
  await tx`insert into contacts (id, group_id, kind, name) values (${id}, ${groupId}, ${kind}, ${name})`
  return id
}

// Markanın varsayılan kategorisi yoksa ilk kullanılan kategori olur (sonra Rehber'den değişir).
export async function learnBrandCategory(tx: Tx, contactId: string | null, categoryId: string) {
  if (!contactId) return
  await tx`update contacts set default_category_id = ${categoryId}
           where id = ${contactId} and kind = 'brand' and default_category_id is null`
}

// Çağıran kullanıcının üyeliği + grup bilgisi.
export async function loadMember(tx: Tx, userId: string) {
  const [m] = await tx`
    select m.id as member_id, m.group_id, g.base_currency, g.lock_date::text as lock_date, c.exponent
    from members m
    join groups g on g.id = m.group_id
    join currencies c on c.code = g.base_currency
    where m.user_id = ${userId}`
  if (!m) throw new HttpError(403, 'Bir gruba üye değilsin', 'not_member')
  return m as { member_id: string; group_id: string; base_currency: string; lock_date: string | null; exponent: number }
}

// Düzenlenecek/silinecek kayıt: sahibi olmalı, silinmemiş olmalı, dönem kilitli olmamalı. Satırı kilitler.
export async function loadOwnedEntry(
  tx: Tx,
  entryId: unknown,
  member: { member_id: string; lock_date: string | null },
) {
  if (typeof entryId !== 'string') throw new HttpError(422, 'entry_id geçersiz', 'invalid_entry')
  const [e] = await tx`
    select id, member_id, entry_date::text as entry_date, deleted_at from journal_entries
    where id = ${entryId} for update`
  if (!e || e.deleted_at) throw new HttpError(404, 'Kayıt bulunamadı', 'not_found')
  if (e.member_id !== member.member_id) throw new HttpError(403, 'Bu kaydı sadece sahibi değiştirebilir', 'not_owner')
  assertNotLocked(member.lock_date, e.entry_date)
  return e as { id: string; member_id: string; entry_date: string }
}

// Hesap verilmediyse üyenin ana para birimindeki ilk nakit hesabı; yoksa "Nakit" açılır.
export async function resolveAccount(tx: Tx, groupId: string, memberId: string, currency: string, accountId?: string) {
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

// Üyenin kişi bazlı alacak ("receivable") / borç ("payable") hesabı; yoksa açılır.
export async function resolveDebtAccount(
  tx: Tx,
  m: { group_id: string; member_id: string; base_currency: string },
  subtype: 'receivable' | 'payable',
) {
  const [found] = await tx`
    select id from accounts
    where group_id = ${m.group_id} and owner_member_id = ${m.member_id} and subtype = ${subtype}
      and currency = ${m.base_currency} and archived_at is null
    order by created_at limit 1 for update`
  if (found) return found.id as string
  const id = uuidv7()
  const [type, name] = subtype === 'receivable' ? ['asset', 'Alacaklar'] : ['liability', 'Borçlar']
  await tx`
    insert into accounts (id, group_id, owner_member_id, type, subtype, name, currency)
    values (${id}, ${m.group_id}, ${m.member_id}, ${type}, ${subtype}, ${name}, ${m.base_currency})`
  return id
}

export type NewLine = { account: string; dir: 'debit' | 'credit'; contactId?: string | null }

export type RawLine = {
  account: string
  dir: 'debit' | 'credit'
  amount: bigint // satırın para biriminde (minor)
  currency: string
  base: bigint // grup ana para biriminde (minor)
  rate?: string // 1 satır para birimi = rate ana para birimi (varsayılan 1)
  contactId?: string | null
}

type EntryOwner = { group_id: string; member_id: string; base_currency: string }

// Çok para birimli, çift taraflı kayıt yazar (denge DB trigger'ında da zorlanır).
export async function postRawEntry(
  tx: Tx,
  m: EntryOwner,
  e: { date: string; description?: string; sourceType?: string; isEstimated?: boolean; lines: RawLine[] },
) {
  const entryId = uuidv7()
  await tx`
    insert into journal_entries (id, group_id, member_id, created_by, entry_date, description, source_type, is_estimated)
    values (${entryId}, ${m.group_id}, ${m.member_id}, ${m.member_id}, ${e.date}, ${e.description ?? ''},
            ${e.sourceType ?? null}, ${e.isEstimated ?? false})`
  for (const [i, l] of e.lines.entries()) {
    await tx`
      insert into journal_lines (id, entry_id, account_id, contact_id, direction, amount, currency, base_amount, fx_rate, position)
      values (${uuidv7()}, ${entryId}, ${l.account}, ${l.contactId ?? null}, ${l.dir}, ${l.amount.toString()}, ${l.currency},
              ${l.base.toString()}, ${l.rate ?? '1'}, ${i})`
  }
  return entryId
}

// Ana para biriminde, tek tutarlı kayıt (kısayol).
export function postEntry(
  tx: Tx,
  m: EntryOwner,
  e: { date: string; amount: bigint; description?: string; sourceType?: string; lines: NewLine[] },
) {
  return postRawEntry(tx, m, {
    date: e.date, description: e.description, sourceType: e.sourceType,
    lines: e.lines.map((l) => ({
      account: l.account, dir: l.dir, amount: e.amount, currency: m.base_currency, base: e.amount, contactId: l.contactId,
    })),
  })
}

// Üyenin kendi bilanço hesabını (herhangi bir para biriminde) kilitleyip döndürür.
export async function lockOwnAccount(tx: Tx, groupId: string, memberId: string, accountId: unknown) {
  if (typeof accountId !== 'string') throw new HttpError(422, 'account geçersiz', 'invalid_account')
  const [acc] = await tx`
    select id, currency, type from accounts
    where id = ${accountId} and group_id = ${groupId} and owner_member_id = ${memberId}
      and type in ('asset', 'liability') and not is_placeholder and archived_at is null
    for update`
  if (!acc) throw new HttpError(422, 'account geçersiz', 'invalid_account')
  return acc as { id: string; currency: string; type: 'asset' | 'liability' }
}
