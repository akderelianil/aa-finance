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

export async function findOrCreateContact(tx: Tx, groupId: string, name: string) {
  const [found] = await tx`
    select id from contacts
    where group_id = ${groupId} and archived_at is null and lower(name) = lower(${name})
    order by created_at limit 1`
  if (found) return found.id as string
  const id = uuidv7()
  await tx`insert into contacts (id, group_id, name) values (${id}, ${groupId}, ${name})`
  return id
}

// Çağıran kullanıcının üyeliği + grup bilgisi.
export async function loadMember(tx: Tx, userId: string) {
  const [m] = await tx`
    select m.id as member_id, m.group_id, g.base_currency, g.lock_date, c.exponent
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
