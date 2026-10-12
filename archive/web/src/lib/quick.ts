import type { AccountNode } from './ledger'

// Quick Entry (Gelir · Gider · Transfer · Borç): simple forms that build a journal-post line list.
// Saved entries are plain journal entries; they are edited in the General Journal editor.
// Amounts here are minor units (number). Every foreign line gets an explicit base_amount so the entry
// balances exactly (no rounding difference between lines on the server). Rate math is exact (bigint), never float.

export type QuickLine = {
  account_id: string
  side: 'debit' | 'credit'
  amount: string
  base_amount?: string
  memo?: string
}

export type FxCtx = {
  base: string
  exp: (currency: string) => number
  /** Day rate: base units per 1 unit of the currency; undefined while unknown. */
  rate: (currency: string) => string | undefined
}

/** round(a * n / d) for positive integers, half up, exact (the server rounds numeric the same way). */
export function mulDivRound(a: number, n: bigint, d: bigint): number {
  return Number((2n * BigInt(a) * n + d) / (2n * d))
}

/** Minor units of a currency with exponent fromExp → minor units of another (toExp) at `rate` (decimal string). */
export function scaleMinor(minor: number, rate: string, fromExp: number, toExp: number): number | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(rate)
  if (!m) return null
  const num = BigInt(m[1] + (m[2] ?? ''))
  return mulDivRound(minor, num * 10n ** BigInt(toExp), 10n ** BigInt((m[2] ?? '').length + fromExp))
}

export const fromMinor = (minor: number, exponent: number) =>
  exponent === 0 ? String(minor) : (minor / 10 ** exponent).toFixed(exponent)

/** Account currency minor → base minor with the day rate; null when the rate is unknown. */
export function toBaseMinor(fx: FxCtx, minor: number, currency: string): number | null {
  if (currency === fx.base) return minor
  const r = fx.rate(currency)
  if (!r) return null
  return scaleMinor(minor, r, fx.exp(currency), fx.exp(fx.base))
}

/** Minor amount in one currency → the other currency with day rates (a suggestion only). */
export function convertMinor(fx: FxCtx, minor: number, from: string, to: string): number | null {
  if (from === to) return minor
  const b = toBaseMinor(fx, minor, from)
  if (b === null) return null
  if (to === fx.base) return b
  const r = fx.rate(to)
  if (!r) return null
  const m = /^(\d+)(?:\.(\d+))?$/.exec(r)
  const num = m ? BigInt(m[1] + (m[2] ?? '')) : 0n
  if (num === 0n) return null
  return mulDivRound(b, 10n ** BigInt(fx.exp(to) + (m![2] ?? '').length), num * 10n ** BigInt(fx.exp(fx.base)))
}

function line(fx: FxCtx, acc: AccountNode, side: 'debit' | 'credit', minor: number, base: number, memo?: string): QuickLine {
  return {
    account_id: acc.id,
    side,
    amount: fromMinor(minor, fx.exp(acc.currency)),
    ...(acc.currency !== fx.base ? { base_amount: fromMinor(base, fx.exp(fx.base)) } : {}),
    ...(memo?.trim() ? { memo: memo.trim() } : {}),
  }
}

export type Split = { account: AccountNode; amount: number; memo: string }

/**
 * Gider: Borç gider hesapları / Alacak ödeme hesabı. Gelir: Borç tahsil hesabı / Alacak gelir hesapları.
 * moneyAmount is what left (or entered) the money account; it is needed only when a split has another currency.
 */
export function incomeExpenseLines(
  fx: FxCtx, kind: 'income' | 'expense', money: AccountNode, splits: Split[], moneyAmount: number | null,
): QuickLine[] | null {
  if (splits.length === 0 || splits.some((s) => s.amount <= 0)) return null
  const splitSide = kind === 'expense' ? 'debit' : 'credit'
  const moneySide = kind === 'expense' ? 'credit' : 'debit'
  const mixed = splits.some((s) => s.account.currency !== money.currency)

  let bases: number[]
  let moneyMinor: number
  if (!mixed) {
    moneyMinor = splits.reduce((sum, s) => sum + s.amount, 0)
    const b = splits.map((s) => toBaseMinor(fx, s.amount, s.account.currency))
    if (b.some((x) => x === null)) return null
    bases = b as number[]
  } else if (money.currency === fx.base) {
    // The money line fixes the base total; foreign splits share the rest in proportion to their day-rate value.
    if (!moneyAmount || moneyAmount <= 0) return null
    moneyMinor = moneyAmount
    bases = splits.map((s) => (s.account.currency === fx.base ? s.amount : 0))
    const rest = moneyAmount - bases.reduce((a, b) => a + b, 0)
    const foreign = splits.map((_, i) => i).filter((i) => splits[i].account.currency !== fx.base)
    if (rest <= 0) return null
    const weights = foreign.map((i) => toBaseMinor(fx, splits[i].amount, splits[i].account.currency) ?? splits[i].amount)
    const total = weights.reduce((a, b) => a + b, 0)
    let left = rest
    foreign.forEach((i, k) => {
      bases[i] = k === foreign.length - 1 ? left : mulDivRound(rest, BigInt(weights[k]), BigInt(total))
      left -= bases[i]
    })
    if (bases.some((b) => b <= 0)) return null
  } else {
    if (!moneyAmount || moneyAmount <= 0) return null
    moneyMinor = moneyAmount
    const b = splits.map((s) => toBaseMinor(fx, s.amount, s.account.currency))
    if (b.some((x) => x === null)) return null
    bases = b as number[]
  }

  const total = bases.reduce((a, b) => a + b, 0)
  return [
    ...splits.map((s, i) => line(fx, s.account, splitSide, s.amount, bases[i], s.memo)),
    line(fx, money, moneySide, moneyMinor, total),
  ]
}

/**
 * Transfer: Borç hedef / Alacak kaynak. counterAmount is what reached the target when the currencies differ.
 * A fee (source currency) adds a Borç line on the fee account; the source pays amount + fee.
 */
export function transferLines(
  fx: FxCtx, from: AccountNode, to: AccountNode, amount: number, counterAmount: number | null,
  fee: number, feeAccount: AccountNode | null,
): QuickLine[] | null {
  if (from.id === to.id || amount <= 0 || fee < 0) return null
  const same = from.currency === to.currency
  const toMinor = same ? amount : counterAmount
  if (!toMinor || toMinor <= 0) return null

  let transferBase: number | null
  if (from.currency === fx.base) transferBase = amount
  else if (to.currency === fx.base) transferBase = toMinor
  else transferBase = toBaseMinor(fx, amount, from.currency)
  if (transferBase === null) return null

  const lines = [line(fx, to, 'debit', toMinor, transferBase)]
  let feeBase = 0
  if (fee > 0) {
    if (!feeAccount) return null
    feeBase = mulDivRound(fee, BigInt(transferBase), BigInt(amount))
    let feeMinor: number
    if (feeAccount.currency === from.currency) feeMinor = fee
    else if (feeAccount.currency === fx.base) feeMinor = feeBase
    else return null
    lines.push(line(fx, feeAccount, 'debit', feeMinor, feeBase))
  }
  lines.push(line(fx, from, 'credit', amount + fee, transferBase + feeBase))
  return lines
}

// Borç (between people): Borç Alma and Tahsilat bring money in; Borç Verme and Ödeme send it out.
export type DebtMode = 'borrow' | 'lend' | 'collect' | 'pay'
export const DEBT_MODES = ['lend', 'borrow', 'collect', 'pay'] as const
export const moneyIn = (m: DebtMode) => m === 'borrow' || m === 'collect'
/** Borç Alma and Ödeme use Kişilere Borçlar (payable); Borç Verme and Tahsilat use Kişilerden Alacaklar (receivable). */
export const debtSubtype = (m: DebtMode) => (m === 'borrow' || m === 'pay' ? 'payable' : 'receivable')

/**
 * Borç Alma = Borç money / Alacak Kişilere Borçlar, Borç Verme = Borç Kişilerden Alacaklar / Alacak money,
 * Tahsilat = Borç money / Alacak Kişilerden Alacaklar, Ödeme = Borç Kişilere Borçlar / Alacak money.
 * amount is in the money currency; debtAmount is the debt account amount when the currencies differ.
 */
export function debtLines(
  fx: FxCtx, mode: DebtMode, money: AccountNode, debt: AccountNode, amount: number, debtAmount: number | null,
): QuickLine[] | null {
  const differ = money.currency !== debt.currency
  return moneyIn(mode)
    ? transferLines(fx, debt, money, differ ? debtAmount ?? 0 : amount, differ ? amount : null, 0, null)
    : transferLines(fx, money, debt, amount, differ ? debtAmount : null, 0, null)
}

// ATM: bank (or credit card, cash advance) ↔ cash. Accounts match by kind (a child takes the kind of its group).
export const isCash = (a: AccountNode) => a.subtype === 'cash'
export const isBank = (a: AccountNode) => a.subtype === 'bank'
export const isCard = (a: AccountNode) => a.subtype === 'credit_card'
