// Currency conversion on integer minor units. Rates are decimal text: 1 unit of the currency = rate units of base.
// BigInt inside, so no float math; results are safe integers.

const RATE = /^\d+(\.\d+)?$/

/** amount (minor units of a currency with `from` decimals) × rate → minor units with `to` decimals. Half away from zero. */
export function toBase(amount: number, rate: string, from: number, to: number): number {
  if (!RATE.test(rate)) throw new Error(`bad rate ${rate}`)
  const [int, frac = ''] = rate.split('.')
  const num = BigInt(amount) * BigInt(int + frac) * 10n ** BigInt(Math.max(0, to - from))
  const den = 10n ** BigInt(frac.length + Math.max(0, from - to))
  return Number(divRound(num, den))
}

/** The rate that turns `amount` into `base` (same sign, both nonzero), up to 12 decimals, trailing zeros cut. */
export function rateOf(amount: number, base: number, from: number, to: number): string {
  const scale = 12
  const num = BigInt(Math.abs(base)) * 10n ** BigInt(scale + Math.max(0, from - to))
  const den = BigInt(Math.abs(amount)) * 10n ** BigInt(Math.max(0, to - from))
  const r = divRound(num, den)
  if (r === 0n) throw new Error('rate below 1e-12')
  const s = r.toString().padStart(scale + 1, '0')
  const out = `${s.slice(0, -scale)}.${s.slice(-scale)}`.replace(/\.?0+$/, '')
  return out
}

function divRound(n: bigint, d: bigint): bigint {
  const q = n / d
  const r = n % d
  return 2n * (r < 0n ? -r : r) >= d ? q + (n < 0n ? -1n : 1n) : q
}
