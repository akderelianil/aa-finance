import { useQuery } from '@tanstack/react-query'
import type { AccountNode } from './ledger'
import { supabase } from './supabase'

// Per-account debit/credit totals in the base currency before the period and inside it (account_period_totals).
export type Totals = { beforeDebit: number; beforeCredit: number; debit: number; credit: number }
const ZERO: Totals = { beforeDebit: 0, beforeCredit: 0, debit: 0, credit: 0 }

export function usePeriodTotals(from: string, to: string) {
  return useQuery({
    queryKey: ['ledger', 'period-totals', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('account_period_totals', { p_from: from || null, p_to: to })
      if (error) throw error
      return new Map((data as { account_id: string; before_debit: number; before_credit: number; debit: number; credit: number }[])
        .map((r) => [r.account_id, {
          beforeDebit: Number(r.before_debit), beforeCredit: Number(r.before_credit),
          debit: Number(r.debit), credit: Number(r.credit),
        }]))
    },
  })
}

export type ReportNode = { node: AccountNode; totals: Totals; children: ReportNode[] }

/** Subtree sums for every node: a parent row shows its own lines plus all descendants. */
export function rollUp(nodes: AccountNode[], totals: Map<string, Totals>): ReportNode[] {
  return nodes.map((node) => {
    const children = rollUp(node.children, totals)
    const own = totals.get(node.id) ?? ZERO
    const sum = children.reduce((s, c) => ({
      beforeDebit: s.beforeDebit + c.totals.beforeDebit, beforeCredit: s.beforeCredit + c.totals.beforeCredit,
      debit: s.debit + c.totals.debit, credit: s.credit + c.totals.credit,
    }), { ...own })
    return { node, totals: sum, children }
  })
}

export const cumulativeNet = (t: Totals) => t.beforeDebit + t.debit - t.beforeCredit - t.credit
export const periodNet = (t: Totals) => t.debit - t.credit
export const isEmpty = (t: Totals) => !t.beforeDebit && !t.beforeCredit && !t.debit && !t.credit
