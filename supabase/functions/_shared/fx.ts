import { HttpError } from './http.ts'
import type { Tx } from './db.ts'
import { uuidv7 } from './uuid.ts'

// Kur: "1 <foreign> = rate <grup ana para birimi>". Kur numeric → string; hesaplar SQL numeric ile (float yok).
export function parseRate(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null
  const s = typeof v === 'string' ? v.trim().replace(',', '.') : typeof v === 'number' ? String(v) : ''
  if (!/^\d{1,12}(\.\d{1,10})?$/.test(s) || Number(s) <= 0) throw new HttpError(422, 'rate geçersiz', 'invalid_rate')
  return s
}

export async function exponentOf(tx: Tx, currency: string): Promise<number> {
  const [c] = await tx`select exponent from currencies where code = ${currency}`
  if (!c) throw new HttpError(422, 'Desteklenmeyen para birimi', 'invalid_currency')
  return c.exponent as number
}

// Verilen kur ya da son kayıtlı kur; ikisi de yoksa kullanıcıdan kur istenir.
export async function resolveRate(
  tx: Tx, groupId: string, foreign: string, base: string, given: string | null,
): Promise<string> {
  if (given) return given
  const [r] = await tx`
    select rate::text as rate from fx_rates
    where group_id = ${groupId} and base = ${foreign} and quote = ${base}
    order by rate_date desc limit 1`
  if (!r) throw new HttpError(422, 'Bu para birimi için kur gerekli', 'rate_required')
  return (r.rate as string).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

export async function saveRate(tx: Tx, groupId: string, foreign: string, base: string, date: string, rate: string) {
  await tx`
    insert into fx_rates (id, group_id, base, quote, rate_date, rate)
    values (${uuidv7()}, ${groupId}, ${foreign}, ${base}, ${date}, ${rate})
    on conflict (group_id, base, quote, rate_date) do update set rate = excluded.rate`
}

// Yabancı para tutarı (minor) → ana para birimi tutarı (minor), kur ile; yuvarlama: en yakın.
export async function toBase(
  tx: Tx, amount: bigint, foreignExp: number, baseExp: number, rate: string,
): Promise<bigint> {
  const [r] = await tx`
    select round(${amount.toString()}::numeric * ${rate}::numeric * power(10::numeric, ${baseExp})
                 / power(10::numeric, ${foreignExp}))::text as v`
  const v = BigInt(r.v as string)
  if (v <= 0n) throw new HttpError(422, 'Tutar çok küçük', 'invalid_amount')
  return v
}

// Hesaptan `amount` (hesap para biriminde) çıkarken ortalama maliyetle düşülecek ana para birimi tutarı.
// Hesap satırı çağıran tarafından FOR UPDATE ile kilitlenmiş olmalı.
export async function averageCost(tx: Tx, accountId: string, amount: bigint): Promise<bigint> {
  const [b] = await tx`
    select coalesce(sum(case when l.direction = 'debit' then l.amount else -l.amount end), 0)::text as net,
           coalesce(sum(case when l.direction = 'debit' then l.base_amount else -l.base_amount end), 0)::text as net_base
    from journal_lines l join journal_entries e on e.id = l.entry_id
    where l.account_id = ${accountId} and e.deleted_at is null`
  const net = BigInt(b.net as string)
  const netBase = BigInt(b.net_base as string)
  if (amount > net) throw new HttpError(422, 'Hesapta yeterli bakiye yok', 'insufficient_balance')
  if (amount === net) return netBase
  const [r] = await tx`select round(${netBase.toString()}::numeric * ${amount.toString()}::numeric / ${net.toString()}::numeric)::text as v`
  const v = BigInt(r.v as string)
  return v > 0n ? v : 1n
}

export async function fxGainLossAccount(tx: Tx, groupId: string): Promise<string> {
  const [a] = await tx`select id from accounts where group_id = ${groupId} and system_key = 'fx_gain_loss'`
  if (!a) throw new Error('fx_gain_loss account missing for group ' + groupId)
  return a.id as string
}
