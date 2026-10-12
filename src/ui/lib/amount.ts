// Typed amounts ("1.234,56" or "1234.56") ↔ integer minor units. No float math.

/** User input → canonical decimal string ("1234.56"); null when invalid or too many decimals. */
export function parseDecimal(s: string, exponent: number): string | null {
  let v = s.trim().replace(/\s/g, '')
  if (!v) return null
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.')
  const m = /^(\d+)(?:\.(\d+))?$/.exec(v)
  if (!m || (m[2]?.length ?? 0) > exponent) return null
  return m[2] ? `${m[1]}.${m[2]}` : m[1]
}

/** Canonical decimal string → minor units. */
export function toMinor(decimal: string, exponent: number): number {
  const [i, f = ''] = decimal.split('.')
  return Number(i) * 10 ** exponent + Number(f.padEnd(exponent, '0') || 0)
}

/** Minor units → plain decimal string for a form field ("1234.56"). */
export function toDecimal(minor: number, exponent: number): string {
  const s = Math.abs(minor).toString().padStart(exponent + 1, '0')
  return exponent ? `${s.slice(0, -exponent)}.${s.slice(-exponent)}` : s
}

export type AmountIssue = 'format' | 'decimals' | 'zero' | 'large'
const MAX_MINOR = 1e14

/** What is wrong with a typed amount; null when fine or empty (the caller decides if it is required). */
export function amountIssue(raw: string, exponent: number): AmountIssue | null {
  const v = raw.trim().replace(/\s/g, '')
  if (!v) return null
  const parsed = parseDecimal(v, exponent)
  if (parsed === null) return /^\d+(?:[.,]\d+)?$/.test(v) ? 'decimals' : 'format'
  const minor = toMinor(parsed, exponent)
  if (minor <= 0) return 'zero'
  if (minor > MAX_MINOR) return 'large'
  return null
}

/** "12" → "12.00" after the field loses focus. */
export function tidyAmount(raw: string, exponent: number): string {
  const v = parseDecimal(raw, exponent)
  if (v === null) return raw
  const [i, f = ''] = v.split('.')
  return exponent > 0 ? `${i}.${f.padEnd(exponent, '0')}` : i
}

export const today = () => new Date().toLocaleDateString('sv')

/** Base minor units → minor units of a currency at `rate` (1 unit = rate base). For suggestions; half away from zero. */
export function fromBase(baseMinor: number, rate: string, baseExp: number, exp: number): number {
  const [int, frac = ''] = rate.split('.')
  const num = BigInt(baseMinor) * 10n ** BigInt(exp + frac.length)
  const den = BigInt(int + frac) * 10n ** BigInt(baseExp)
  if (den === 0n) return 0
  const q = num / den
  const r = num % den
  return Number(2n * (r < 0n ? -r : r) >= den ? q + (num < 0n ? -1n : 1n) : q)
}

/** "₺" for TRY; the code itself when the locale has no short symbol. */
export function currencySymbol(code: string) {
  const part = new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency')
  return part?.value ?? code
}
