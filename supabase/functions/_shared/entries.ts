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

// Gruplayıcı kategori adı yazılırsa aynı adla yeni kategori açılmaz; alt kategori seçilmeli.
export async function findOrCreateCategory(tx: Tx, groupId: string, type: string, name: string) {
  const [found] = await tx`
    select id, is_placeholder from accounts
    where group_id = ${groupId} and type = ${type} and system_key is null and archived_at is null
      and lower(name) = lower(${name})
    order by is_placeholder, created_at limit 1`
  if (found?.is_placeholder) throw new HttpError(422, 'Gruplayıcı kategoriye kayıt girilmez', 'placeholder_account')
  if (found) return found.id as string
  const id = uuidv7()
  await tx`insert into accounts (id, group_id, type, name) values (${id}, ${groupId}, ${type}, ${name})`
  return id
}

// Kodun kayıt attığı şablon kategorisi (kredi masrafı, vadeli getiri ...): ad değişse de template_key ile bulunur.
// Kullanıcı silmişse aynı adla bulunur ya da açılır ve anahtarı geri alır.
export async function findTemplateCategory(tx: Tx, groupId: string, key: string, type: string, name: string) {
  const [found] = await tx`select id from accounts where group_id = ${groupId} and template_key = ${key}`
  if (found) return found.id as string
  const id = await findOrCreateCategory(tx, groupId, type, name)
  await tx`update accounts set template_key = ${key} where id = ${id} and template_key is null`
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
      and currency = ${m.base_currency} and not is_placeholder and archived_at is null
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
  memo?: string | null
}

type EntryOwner = { group_id: string; member_id: string; base_currency: string }

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
  e: { date: string; description?: string; sourceType?: string; isEstimated?: boolean; lines: RawLine[]; tags?: string[] },
) {
  const entryId = uuidv7()
  await tx`
    insert into journal_entries (id, group_id, member_id, created_by, entry_date, description, source_type, is_estimated)
    values (${entryId}, ${m.group_id}, ${m.member_id}, ${m.member_id}, ${e.date}, ${e.description ?? ''},
            ${e.sourceType ?? null}, ${e.isEstimated ?? false})`
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

// Kalemler (GnuCash split): fişteki diğer kategoriler [{category_name, amount}]. Boş dizi = kalem yok.
export type Part = { account: string; amount: bigint }

export async function parseItems(tx: Tx, groupId: string, kind: string, v: unknown, exponent: number): Promise<Part[]> {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v) || v.length > 20) throw new HttpError(422, 'items geçersiz', 'invalid_items')
  const parts: Part[] = []
  for (const r of v) {
    const o = typeof r === 'object' && r !== null ? r as Record<string, unknown> : {}
    if (typeof o.category_name !== 'string' || !o.category_name.trim() || o.category_name.length > 60) {
      throw new HttpError(422, 'items geçersiz', 'invalid_items')
    }
    parts.push({
      account: await findOrCreateCategory(tx, groupId, kind, o.category_name.trim()),
      amount: parseAmount(o.amount, exponent),
    })
  }
  return parts
}

// Ana kategori + kalemler; toplamdan kalan ana kategoriye yazılır.
export function withRest(mainAccount: string, total: bigint, parts: Part[]): Part[] {
  const rest = parts.reduce((r, p) => r - p.amount, total)
  if (rest <= 0n) throw new HttpError(422, 'Kalemler toplamı tutarı aşıyor', 'items_exceed_total')
  return [{ account: mainAccount, amount: rest }, ...parts]
}

// Ana para biriminde, tek tutarlı kayıt (kısayol).
export function postEntry(
  tx: Tx,
  m: EntryOwner,
  e: { date: string; amount: bigint; description?: string; sourceType?: string; lines: NewLine[]; tags?: string[] },
) {
  return postRawEntry(tx, m, {
    date: e.date, description: e.description, sourceType: e.sourceType, tags: e.tags,
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

// Soft delete with the links of hidden flows: installment plan, plans, term deposit, loan.
export async function softDeleteEntry(tx: Tx, entryId: string, memberId: string) {
  const entry = { id: entryId }
  const m = { member_id: memberId }
  // Taksit bağlantıları: alışveriş kaydı silinirse plan kalkar (ödenmiş taksit varsa engel);
  // ödeme kaydı silinirse taksit yeniden açılır.
  const [plan] = await tx`select id from installment_plans where purchase_entry_id = ${entry.id}`
  if (plan) {
    const [paid] = await tx`select 1 from installments where plan_id = ${plan.id} and payment_entry_id is not null limit 1`
    if (paid) throw new HttpError(422, 'Ödenmiş taksitleri olan alışveriş silinemez', 'plan_has_payments')
    await tx`delete from installments where plan_id = ${plan.id}`
    await tx`delete from installment_plans where id = ${plan.id}`
  }
  await tx`update installments set payment_entry_id = null where payment_entry_id = ${entry.id}`
  // Bu kayıtla doğan plan (borç vadesi) da gider.
  await tx`delete from plans where source_entry_id = ${entry.id}`
  // Vadeli hesap: açılış silinirse hesap kalkar; vade sonu kaydı silinirse önceki dönem geri gelir.
  const [dep] = await tx`
    select account_id, open_entry_id, prev from deposit_settings
    where open_entry_id = ${entry.id} or last_settle_entry_id = ${entry.id} for update`
  if (dep && dep.open_entry_id === entry.id) {
    const [other] = await tx`
      select 1 from journal_lines l join journal_entries e on e.id = l.entry_id
      where l.account_id = ${dep.account_id} and e.deleted_at is null and e.id <> ${entry.id} limit 1`
    if (other) throw new HttpError(422, 'Hareketi olan vadeli hesabın açılışı silinemez', 'deposit_has_movements')
    await tx`delete from deposit_settings where account_id = ${dep.account_id}`
    await tx`update accounts set archived_at = now() where id = ${dep.account_id}`
  } else if (dep && dep.prev) {
    const p = dep.prev as Record<string, unknown>
    await tx`
      update deposit_settings set principal = ${p.principal as string}, annual_rate = ${p.annual_rate as string},
        days = ${p.days as number}, start_date = ${p.start_date as string}, maturity_date = ${p.maturity_date as string},
        last_settle_entry_id = ${(p.last_settle_entry_id as string | null) ?? null}, prev = ${tx.json((p.prev ?? null) as never)},
        closed_at = null
      where account_id = ${dep.account_id}`
    await tx`update accounts set archived_at = null where id = ${dep.account_id}`
  }
  // Kredi kaydı silinirse kredi hesabı da gider (başka hareketi varsa silinemez).
  const [loan] = await tx`select account_id from loan_settings where source_entry_id = ${entry.id}`
  if (loan) {
    const [other] = await tx`
      select 1 from journal_lines l join journal_entries e on e.id = l.entry_id
      where l.account_id = ${loan.account_id} and e.deleted_at is null and e.id <> ${entry.id} limit 1`
    if (other) throw new HttpError(422, 'Taksit ödemesi olan kredi silinemez', 'loan_has_payments')
    await tx`delete from loan_settings where account_id = ${loan.account_id}`
    await tx`update accounts set archived_at = now() where id = ${loan.account_id}`
  }
  await tx`update journal_entries set deleted_at = now(), deleted_by = ${m.member_id}, updated_at = now()
           where id = ${entry.id}`
}
