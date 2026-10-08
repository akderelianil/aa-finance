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

// qty × price (numeric string'ler) → minor unit; en yakın yuvarlama.
export async function minorOf(tx: Tx, qty: string, price: string, exp: number): Promise<bigint> {
  const [r] = await tx`select round(${qty}::numeric * ${price}::numeric * power(10::numeric, ${exp}))::text as v`
  return BigInt(r.v as string)
}

// round(value × num / den) — oransal düşüm (satışta defter değeri) için.
export async function ratio(tx: Tx, value: bigint, num: bigint, den: bigint): Promise<bigint> {
  const [r] = await tx`select round(${value.toString()}::numeric * ${num.toString()}::numeric / ${den.toString()}::numeric)::text as v`
  return BigInt(r.v as string)
}

// Hesabın net (borç − alacak) bakiyesi: hesap para biriminde ve ana para biriminde.
export async function accountNet(tx: Tx, accountId: string): Promise<{ net: bigint; netBase: bigint }> {
  const [b] = await tx`
    select coalesce(sum(case when l.direction = 'debit' then l.amount else -l.amount end), 0)::text as net,
           coalesce(sum(case when l.direction = 'debit' then l.base_amount else -l.base_amount end), 0)::text as net_base
    from journal_lines l join journal_entries e on e.id = l.entry_id
    where l.account_id = ${accountId} and e.deleted_at is null`
  return { net: BigInt(b.net as string), netBase: BigInt(b.net_base as string) }
}

// Adet/fiyat: pozitif ondalık string (numeric(28,10) sınırı içinde).
export function parsePositiveDecimal(v: unknown, field: string): string {
  const s = typeof v === 'string' ? v.trim().replace(',', '.') : typeof v === 'number' ? String(v) : ''
  if (!/^\d{1,15}(\.\d{1,10})?$/.test(s) || Number(s) <= 0) throw new HttpError(422, `${field} geçersiz`, `invalid_${field}`)
  return s
}

// TCMB indicative rate (ForexBuying, VUK valuation rate) for `currency` → TRY on `date` or the last published day
// before it (weekends, holidays, before 15:30). null when TCMB has no rate or does not answer.
export async function fetchTcmbRate(currency: string, date: string): Promise<{ rate: string; date: string } | null> {
  const d = new Date(date + 'T00:00:00Z')
  for (let i = 0; i < 10; i++) {
    const y = d.getUTCFullYear()
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    try {
      const res = await fetch(`https://www.tcmb.gov.tr/kurlar/${y}${mo}/${day}${mo}${y}.xml`,
        { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const xml = await res.text()
        const block = new RegExp(`<Currency[^>]*CurrencyCode="${currency}"[^>]*>([\\s\\S]*?)</Currency>`).exec(xml)?.[1]
        if (!block) {
          console.warn(`TCMB ${y}-${mo}-${day}: no ${currency} (${xml.slice(0, 120).replace(/\s+/g, ' ')})`)
          return null
        }
        const unit = /<Unit>(\d+)<\/Unit>/.exec(block)?.[1] ?? '1'
        const buying = /<ForexBuying>([\d.]+)<\/ForexBuying>/.exec(block)?.[1]
        if (!buying) return null
        // 1 unit of the currency; JPY and others are published per 100.
        const rate = unit === '1' ? buying : (Number(buying) / Number(unit)).toFixed(10)
        return { rate, date: `${y}-${mo}-${day}` }
      }
      console.warn(`TCMB ${y}-${mo}-${day}: HTTP ${res.status}`)
      await res.body?.cancel()
    } catch (err) {
      console.warn(`TCMB ${y}-${mo}-${day}: ${(err as Error).message}`)
      return null
    }
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return null
}

// Rate for a line in `foreign` on `date`: saved rate of that day, else TCMB (base TRY only, saved), else the last
// saved rate before the date. rate_required when none.
export async function dayRate(tx: Tx, groupId: string, foreign: string, base: string, date: string): Promise<string> {
  const trim = (r: string) => r.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  const [same] = await tx`
    select rate::text as rate from fx_rates
    where group_id = ${groupId} and base = ${foreign} and quote = ${base} and rate_date = ${date}`
  if (same) return trim(same.rate as string)
  if (base === 'TRY') {
    const t = await fetchTcmbRate(foreign, date)
    if (t) {
      await saveRate(tx, groupId, foreign, base, date, t.rate)
      return trim(t.rate)
    }
  }
  const [last] = await tx`
    select rate::text as rate from fx_rates
    where group_id = ${groupId} and base = ${foreign} and quote = ${base} and rate_date <= ${date}
    order by rate_date desc limit 1`
  if (!last) throw new HttpError(422, 'Bu para birimi için kur gerekli', 'rate_required')
  return trim(last.rate as string)
}
