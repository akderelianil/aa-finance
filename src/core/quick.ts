// Quick Entry flows (docs/ux): pure builders from a form to an entries.post input.
// They give exact base amounts whenever currencies differ, so the entry balances without FX rounding.
import type { EntryInput, LineInput } from './api/entries.ts'
import type { AccountType } from './chart.ts'
import { rateOf, toBase } from './money.ts'

export type QuickAccount = { uid: string; type: AccountType; currency: string }
/** Base currency and minor units, from settings.get and currencies.list. */
export type Book = { base: string; minor(code: string): number }

type Common = { date: string; description?: string | null; reference?: string | null }
type Split = { account: QuickAccount; amount: number; memo?: string | null }

export class QuickError extends Error {
  readonly code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}
const fail = (code: string): never => {
  throw new QuickError(code)
}

/** Gider: expense lines (debit), paid from an asset or a card (credit). Amounts in the payment currency. */
export function expense(book: Book, f: Common & { from: QuickAccount; total: number; splits: Split[]; rate?: string }): EntryInput {
  if (f.from.type !== 'asset' && f.from.type !== 'liability') fail('quick_payment_account')
  if (f.splits.some((s) => s.account.type !== 'expense')) fail('quick_expense_account')
  return split(book, f, f.from, f.splits, -1)
}

/** Gelir: income lines (credit), received into an asset (debit). Amounts in the receiving currency. */
export function income(book: Book, f: Common & { to: QuickAccount; total: number; splits: Split[]; rate?: string }): EntryInput {
  if (f.to.type !== 'asset') fail('quick_receive_account')
  if (f.splits.some((s) => s.account.type !== 'income')) fail('quick_income_account')
  return split(book, f, f.to, f.splits, 1)
}

/**
 * `money` gets sign × total, each split the opposite. A split account is in the money currency
 * or in the base currency (converted with `rate`, the last split takes the rounding).
 */
function split(book: Book, f: Common & { total: number; rate?: string }, money: QuickAccount, splits: Split[], sign: 1 | -1): EntryInput {
  if (!(f.total > 0) || !splits.length || splits.some((s) => !(s.amount > 0))) fail('quick_amount')
  if (splits.reduce((s, x) => s + x.amount, 0) !== f.total) fail('quick_split_mismatch')
  const head = { date: f.date, description: f.description ?? null, reference: f.reference ?? null }
  if (splits.every((s) => s.account.currency === money.currency)) {
    // One currency: the server converts (or not, in base) with `rate` or the stored rate.
    const r = money.currency !== book.base && f.rate ? { rate: f.rate } : {}
    return {
      ...head,
      lines: [
        { account: money.uid, amount: sign * f.total, ...r },
        ...splits.map((s) => ({ account: s.account.uid, amount: -sign * s.amount, memo: s.memo ?? null, ...r })),
      ],
    }
  }
  if (splits.some((s) => s.account.currency !== money.currency && s.account.currency !== book.base)) fail('quick_currency_unsupported')
  if (money.currency === book.base) fail('quick_currency_unsupported')
  const rate = f.rate ?? fail('quick_rate_required')
  const from = book.minor(money.currency)
  const to = book.minor(book.base)
  const totalBase = toBase(f.total, rate, from, to)
  let left = totalBase
  const lines: LineInput[] = splits.map((s, i) => {
    const b = i === splits.length - 1 ? left : toBase(s.amount, rate, from, to)
    left -= b
    return s.account.currency === book.base
      ? { account: s.account.uid, amount: -sign * b, memo: s.memo ?? null }
      : { account: s.account.uid, amount: -sign * s.amount, baseAmount: -sign * b, memo: s.memo ?? null }
  })
  return { ...head, lines: [{ account: money.uid, amount: sign * f.total, baseAmount: sign * totalBase }, ...lines] }
}

/**
 * Transfer: `to` debit, `from` credit, an optional fee (in the `from` currency) as an extra debit.
 * Different currencies need `toAmount`; the rate comes from the two amounts when one side is the base currency,
 * else from `rate` (from currency → base).
 */
export function transfer(
  book: Book,
  f: Common & { from: QuickAccount; to: QuickAccount; amount: number; toAmount?: number; fee?: number; feeAccount?: QuickAccount; rate?: string },
): EntryInput {
  if (f.from.uid === f.to.uid) fail('quick_same_account')
  if (f.from.type !== 'asset') fail('quick_from_account')
  if (f.to.type !== 'asset' && f.to.type !== 'liability') fail('quick_to_account')
  const fee = f.fee ?? 0
  if (fee && (!f.feeAccount || f.feeAccount.type !== 'expense')) fail('quick_fee_account')
  return pair(book, f, f.to, f.from, f.amount, f.toAmount, f.rate, fee ? { account: f.feeAccount!, amount: fee } : null)
}

export type DebtKind = 'lend' | 'borrow' | 'collect' | 'repay'

/**
 * Borç: money moves between an asset and a person account (receivables for lend/collect, payables for borrow/repay).
 * `amount` is in the money account currency; `debtAmount` when the debt account currency differs.
 * `rate` (credit account currency → base) is needed only when neither currency is the base.
 */
export function debt(
  book: Book,
  f: Common & { kind: DebtKind; money: QuickAccount; debt: QuickAccount; amount: number; debtAmount?: number; rate?: string },
): EntryInput {
  if (f.money.type !== 'asset' || f.money.uid === f.debt.uid) fail('quick_money_account')
  const receivable = f.kind === 'lend' || f.kind === 'collect'
  if (f.debt.type !== (receivable ? 'asset' : 'liability')) fail('quick_debt_account')
  if (f.money.currency !== f.debt.currency && f.debtAmount === undefined) fail('quick_amount_required')
  return f.kind === 'lend' || f.kind === 'repay'
    ? pair(book, f, f.debt, f.money, f.amount, f.debtAmount, f.rate, null)
    : pair(book, f, f.money, f.debt, f.debtAmount ?? f.amount, f.amount, f.rate, null)
}

/** Two accounts, optional fee. `amount` is in the credit account currency, `debitAmount` in the debit one. */
function pair(
  book: Book, f: Common, debit: QuickAccount, credit: QuickAccount, amount: number, debitAmount: number | undefined,
  rate: string | undefined, fee: { account: QuickAccount; amount: number } | null,
): EntryInput {
  if (!(amount > 0) || (debitAmount !== undefined && !(debitAmount > 0)) || (fee && !(fee.amount > 0))) fail('quick_amount')
  const head = { date: f.date, description: f.description ?? null, reference: f.reference ?? null }
  const feeAmount = fee?.amount ?? 0
  const cur = credit.currency
  const allSame = debit.currency === cur && (!fee || fee.account.currency === cur)
  if (allSame) {
    const r = cur !== book.base && rate ? { rate } : {}
    return {
      ...head,
      lines: [
        { account: debit.uid, amount, ...r },
        ...(fee ? [{ account: fee.account.uid, amount: fee.amount, ...r }] : []),
        { account: credit.uid, amount: -(amount + feeAmount), ...r },
      ],
    }
  }
  const to = book.minor(book.base)
  const from = book.minor(cur)
  const dAmount = debit.currency === cur ? amount : (debitAmount ?? fail('quick_amount_required'))
  // Credit currency → base.
  const r = cur === book.base ? '1'
    : rate ?? (debit.currency === book.base ? rateOf(amount, dAmount, from, to) : fail('quick_rate_required'))
  const conv = (n: number) => (cur === book.base ? n : toBase(n, r, from, to))
  const dBase = debit.currency === book.base ? dAmount : conv(amount)
  const feeBase = fee ? conv(fee.amount) : 0
  const lines: LineInput[] = [{ account: debit.uid, amount: dAmount, baseAmount: dBase }]
  if (fee) {
    if (fee.account.currency === cur) lines.push({ account: fee.account.uid, amount: fee.amount, baseAmount: feeBase })
    else if (fee.account.currency === book.base) lines.push({ account: fee.account.uid, amount: feeBase })
    else fail('quick_currency_unsupported')
  }
  lines.push({ account: credit.uid, amount: -(amount + feeAmount), baseAmount: -(dBase + feeBase) })
  return { ...head, lines }
}
