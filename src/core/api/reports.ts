// Reports in the base currency. All amounts are signed like lines: plus is debit, minus is credit.
// Rows carry the account uid and type; the UI takes names and the tree from accounts.list.
import * as z from 'zod/mini'
import type { AccountType } from '../chart.ts'
import type { Db } from '../db.ts'
import { date, read } from './ctx.ts'

export type ReportRow = { account: string; type: AccountType; balance: number }

async function balances(db: Db, from: string, to: string, types: AccountType[]): Promise<ReportRow[]> {
  const rows = await db.query(
    `SELECT a.uid, a.type, sum(l.base_amount) AS balance
     FROM lines l JOIN accounts a ON a.id = l.account_id
     WHERE l.deleted_at IS NULL AND l.entry_date >= ? AND l.entry_date <= ?
       AND a.type IN (SELECT value FROM json_each(?))
     GROUP BY l.account_id HAVING balance <> 0
     ORDER BY a.id`,
    [from, to, JSON.stringify(types)],
  )
  return rows.map((r) => ({ account: r.uid as string, type: r.type as AccountType, balance: r.balance as number }))
}

const sum = (rows: ReportRow[]) => rows.reduce((s, r) => s + r.balance, 0)

export type TrialRow = ReportRow & { debit: number; credit: number }

/**
 * Mizan: every account with lines up to `asOf`: debit and credit turnover and the balance.
 * The debit and credit balance totals match.
 */
export const trialBalance = read(z.object({ asOf: z.optional(date) }), async (ctx, input) => {
  const rows = await ctx.db.query(
    `SELECT a.uid, a.type, sum(l.base_amount) AS balance,
            sum(max(l.base_amount, 0)) AS debit, -sum(min(l.base_amount, 0)) AS credit
     FROM lines l JOIN accounts a ON a.id = l.account_id
     WHERE l.deleted_at IS NULL AND l.entry_date <= ?
     GROUP BY l.account_id ORDER BY a.id`,
    [input.asOf ?? '9999-12-31'],
  )
  const out = rows.map((r): TrialRow => ({
    account: r.uid as string, type: r.type as AccountType, balance: r.balance as number,
    debit: r.debit as number, credit: r.credit as number,
  }))
  const debit = out.reduce((s, r) => s + Math.max(r.balance, 0), 0)
  return { rows: out, debit, credit: debit - sum(out) }
})

/**
 * Bilanço at `asOf`. Income and expense are not closed yet, so their total is `earnings`
 * (minus is profit). assets + liabilities + equity + earnings = 0.
 */
export const balanceSheet = read(z.object({ asOf: z.optional(date) }), async (ctx, input) => {
  const to = input.asOf ?? '9999-12-31'
  const rows = await balances(ctx.db, '0000-01-01', to, ['asset', 'liability', 'equity'])
  const earnings = sum(await balances(ctx.db, '0000-01-01', to, ['income', 'expense']))
  return { rows, earnings }
})

/** Gelir tablosu for a period. `net` minus is profit. */
export const incomeStatement = read(z.object({ from: date, to: date }), async (ctx, input) => {
  const rows = await balances(ctx.db, input.from, input.to, ['income', 'expense'])
  return { rows, net: sum(rows) }
})
