// Ledger helpers for the UI: the book (base currency, minor units, formatting) and the account tree.
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Account } from '../../core/api/accounts.ts'
import type { AccountType } from '../../core/chart.ts'
import { useOp } from './api'
import { formatLocale } from './format'

export type { Account, AccountType }

export const TYPES: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense']

/** Base currency, minor units per currency and amount formatting in the UI language. */
export function useBook() {
  const { i18n } = useTranslation()
  const settings = useOp('settings.get', {})
  const currencies = useOp('currencies.list', {})
  const base = settings.data?.baseCurrency ?? ''
  const lang = formatLocale(settings.data?.country, i18n.language)
  // Stable functions: grids rebuild their columns when these change.
  return useMemo(() => {
    const minors = new Map((currencies.data ?? []).map((c) => [c.code, c.minorUnit]))
    const minor = (code: string) => minors.get(code) ?? 2
    const fmt = (amount: number, code = base) => formatAmount(amount, minor(code), lang)
    return { base, minor, fmt, currencies: currencies.data ?? [] }
  }, [base, lang, currencies.data])
}

export function formatAmount(minorAmount: number, exponent: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: exponent, maximumFractionDigits: exponent })
    .format(minorAmount / 10 ** exponent)
}

/** Balance in the account's natural side: debit types as is, credit types flipped. */
export const shown = (type: AccountType, signed: number) => (type === 'asset' || type === 'expense' ? signed : 0 - signed)

export type AccountNode = Account & {
  /** Display name: a system account by its key in the UI language. */
  label: string
  depth: number
  /** Ancestor labels joined with ›. */
  path: string
  /** Own plus children, in base currency, signed. */
  treeBase: number
  children: AccountNode[]
}

/** Accounts (flat, parents first) → roots in chart order, each with a rolled-up base total. */
export function useAccountTree(accounts: Account[] | undefined) {
  const { t, i18n } = useTranslation()
  return useMemo(() => buildTree(accounts ?? [], t, i18n), [accounts, t, i18n, i18n.language])
}

function buildTree(accounts: Account[], t: ReturnType<typeof useTranslation>['t'], i18n: ReturnType<typeof useTranslation>['i18n']) {
  const label = (a: Account) =>
    a.systemKey && i18n.exists(`system.${a.systemKey}`) ? t(`system.${a.systemKey}` as 'system.asset') : a.name
  const nodes = new Map<string, AccountNode>()
  for (const a of accounts) nodes.set(a.uid, { ...a, label: label(a), depth: 0, path: '', treeBase: 0, children: [] })
  const roots: AccountNode[] = []
  for (const n of nodes.values()) {
    const p = n.parent ? nodes.get(n.parent) : undefined
    if (p) p.children.push(n)
    else roots.push(n)
  }
  const collator = new Intl.Collator(i18n.language)
  const walk = (n: AccountNode, depth: number, path: string): number => {
    n.depth = depth
    n.path = path
    // System accounts keep chart order; user accounts sort by name after them.
    n.children.sort((a, b) => Number(!a.locked) - Number(!b.locked) || (a.locked ? 0 : collator.compare(a.label, b.label)))
    const childPath = path ? `${path} › ${n.label}` : n.label
    n.treeBase = n.baseBalance + n.children.reduce((s, c) => s + walk(c, depth + 1, childPath), 0)
    return n.treeBase
  }
  roots.sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type))
  for (const r of roots) walk(r, 0, '')
  return { roots, byUid: nodes }
}

export function flattenTree(nodes: AccountNode[]): AccountNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)])
}
