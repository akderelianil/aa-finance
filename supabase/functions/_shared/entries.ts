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

// Çağıran kullanıcının üyeliği + grup bilgisi.
export async function loadMember(tx: Tx, userId: string) {
  const [m] = await tx`
    select m.id as member_id, m.group_id, m.role, g.base_currency, g.lock_date::text as lock_date, c.exponent
    from members m
    join groups g on g.id = m.group_id
    join currencies c on c.code = g.base_currency
    where m.user_id = ${userId}`
  if (!m) throw new HttpError(403, 'Bir gruba üye değilsin', 'not_member')
  return m as {
    member_id: string; group_id: string; role: 'admin' | 'member'; base_currency: string; lock_date: string | null; exponent: number
  }
}

export type Need = 'edit' | 'delete'

// Owner and group admin always may; another member needs a member_access row with a high enough level.
export function canModify(
  actor: { member_id: string; role: string }, ownerId: string, level: Need | undefined, need: Need,
): boolean {
  if (actor.member_id === ownerId || actor.role === 'admin') return true
  return level === 'delete' || (level === 'edit' && need === 'edit')
}

// Düzenlenecek/silinecek kayıt: silinmemiş olmalı, dönem kilitli olmamalı, çağıranın hakkı olmalı. Satırı kilitler.
export async function loadOwnedEntry(
  tx: Tx,
  entryId: unknown,
  member: { member_id: string; role: string; lock_date: string | null },
  need: Need,
) {
  if (typeof entryId !== 'string') throw new HttpError(422, 'entry_id geçersiz', 'invalid_entry')
  const [e] = await tx`
    select id, member_id, entry_date::text as entry_date, deleted_at from journal_entries
    where id = ${entryId} for update`
  if (!e || e.deleted_at) throw new HttpError(404, 'Kayıt bulunamadı', 'not_found')
  const [acc] = await tx`
    select level from member_access where member_id = ${member.member_id} and target_member_id = ${e.member_id}`
  if (!canModify(member, e.member_id, acc?.level, need)) {
    throw new HttpError(403, 'Bu kaydı değiştirme iznin yok', 'not_allowed')
  }
  assertNotLocked(member.lock_date, e.entry_date)
  return e as { id: string; member_id: string; entry_date: string }
}

export type RawLine = {
  account: string
  dir: 'debit' | 'credit'
  amount: bigint // satırın para biriminde (minor)
  currency: string
  base: bigint // grup ana para biriminde (minor)
  rate?: string // 1 satır para birimi = rate ana para birimi (varsayılan 1)
  contactId?: string | null
  memo?: string | null
}

type EntryOwner = { group_id: string; member_id: string; base_currency: string; created_by?: string }

// Etiketler: ["Tatil 2026", ...]. Boş/tekrar eden adlar atılır; en çok 10, her biri en çok 40 karakter.
export function parseTags(v: unknown): string[] {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v) || v.length > 10) throw new HttpError(422, 'tags geçersiz', 'invalid_tags')
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of v) {
    const s = typeof t === 'string' ? t.trim().replace(/^#/, '').trim() : ''
    if (s.length > 40) throw new HttpError(422, 'tags geçersiz', 'invalid_tags')
    if (s && !seen.has(s.toLocaleLowerCase('tr'))) { seen.add(s.toLocaleLowerCase('tr')); out.push(s) }
  }
  return out
}

// Kaydın etiketlerini verilen listeyle değiştirir; yeni ad grupta etiket olarak açılır.
export async function setEntryTags(tx: Tx, groupId: string, entryId: string, names: string[]) {
  await tx`delete from entry_tags where entry_id = ${entryId}`
  for (const name of names) {
    const [found] = await tx`select id from tags where group_id = ${groupId} and lower(name) = lower(${name})`
    const tagId = (found?.id as string | undefined) ?? uuidv7()
    if (!found) await tx`insert into tags (id, group_id, name) values (${tagId}, ${groupId}, ${name})`
    await tx`insert into entry_tags (entry_id, tag_id, group_id) values (${entryId}, ${tagId}, ${groupId})`
  }
}

// Çok para birimli, çift taraflı kayıt yazar (denge DB trigger'ında da zorlanır).
export async function postRawEntry(
  tx: Tx,
  m: EntryOwner,
  e: { date: string; description?: string; lines: RawLine[]; tags?: string[] },
) {
  const entryId = uuidv7()
  await tx`
    insert into journal_entries (id, group_id, member_id, created_by, entry_date, description)
    values (${entryId}, ${m.group_id}, ${m.member_id}, ${m.created_by ?? m.member_id}, ${e.date}, ${e.description ?? ''})`
  await insertLines(tx, entryId, e.lines)
  if (e.tags?.length) await setEntryTags(tx, m.group_id, entryId, e.tags)
  return entryId
}

export async function insertLines(tx: Tx, entryId: string, lines: RawLine[]) {
  for (const [i, l] of lines.entries()) {
    await tx`
      insert into journal_lines
        (id, entry_id, account_id, contact_id, direction, amount, currency, base_amount, fx_rate, memo, position)
      values (${uuidv7()}, ${entryId}, ${l.account}, ${l.contactId ?? null}, ${l.dir}, ${l.amount.toString()}, ${l.currency},
              ${l.base.toString()}, ${l.rate ?? '1'}, ${l.memo ?? null}, ${i})`
  }
}

// Soft delete: the entry stays in the table with deleted_at / deleted_by.
export async function softDeleteEntry(tx: Tx, entryId: string, memberId: string) {
  await tx`update journal_entries set deleted_at = now(), deleted_by = ${memberId}, updated_at = now()
           where id = ${entryId}`
}
