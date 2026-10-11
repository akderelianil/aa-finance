import { parseDecimalInput, toMinor } from './ledger'

export type AmountIssue = 'format' | 'decimals' | 'zero' | 'large'

// Largest amount we accept, in minor units; far below Number.MAX_SAFE_INTEGER so sums stay exact.
const MAX_MINOR = 1e14

/** What is wrong with a typed amount; null when it is fine. An empty string is "not typed yet" (null): the caller decides if it is required. */
export function amountIssue(raw: string, exponent: number): AmountIssue | null {
  const v = raw.trim().replace(/\s/g, '')
  if (!v) return null
  const parsed = parseDecimalInput(v, exponent)
  if (parsed === null) {
    // "12,345" with two decimals is a decimals problem, "1,2,3" a format problem.
    return /^\d+(?:[.,]\d+)?$/.test(v) ? 'decimals' : 'format'
  }
  const minor = toMinor(parsed, exponent)
  if (minor <= 0) return 'zero'
  if (minor > MAX_MINOR) return 'large'
  return null
}

/** Canonical form for display after the field loses focus: "12" → "12.00". */
export function tidyAmount(raw: string, exponent: number): string {
  const v = parseDecimalInput(raw, exponent)
  if (v === null) return raw
  const [i, f = ''] = v.split('.')
  return exponent > 0 ? `${i}.${f.padEnd(exponent, '0')}` : i
}

/** ISO date one year before today (for the "old date" hint). */
export function oneYearAgo(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d.toLocaleDateString('sv')
}
