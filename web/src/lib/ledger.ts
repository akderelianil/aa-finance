import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

// Ledger core data shared by Chart of Accounts, General Journal, Account Register and reports.

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense'
export const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense']

// GnuCash account kinds per type (accounts.subtype); the server checks the same list.
export const SUBTYPES: Record<AccountType, string[]> = {
  asset: ['cash', 'bank', 'deposit', 'investment', 'receivable', 'other'],
  liability: ['credit_card', 'loan', 'payable', 'other'],
  equity: [],
  income: [],
  expense: [],
}

export type Account = {
  id: string
  parent_id: string | null
  code: string
  name: string
  type: AccountType
  subtype: string | null
  currency: string
  owner_member_id: string | null
  is_placeholder: boolean
  system_key: string | null
  template_key: string | null
  /** System account: roots, groups, receivable, payable. No rename, move, archive or delete. */
  locked: boolean
  archived_at: string | null
}

export type AccountNode = Account & {
  children: AccountNode[]
  depth: number
  /** Names of the ancestors, "Varlık › Banka" (empty for a root). */
  path: string
  /** Own net (debit − credit), account currency, minor units. */
  net: number
  /** Subtree net (debit − credit), base currency, minor units. */
  treeNetBase: number
  /** Display-only row that folds same-named accounts of different owners; its children are those accounts. */
  personGroup?: boolean
}

/** Debit-normal types show debit − credit; the others show credit − debit (GnuCash "credit accounts"). */
export const debitNormal = (t: AccountType) => t === 'asset' || t === 'expense'
export const shown = (t: AccountType, net: number) => (debitNormal(t) ? net : -net)

// Codes are hidden in the UI and only order the tree. They sort as numbers per segment: 1.02 < 1.10 < 1.10.01 < 2.
export function compareCodes(a: string, b: string): number {
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1)
    if (d) return d
  }
  return 0
}

export function buildAccountTree(accounts: Account[], net: Map<string, number>, treeBase: Map<string, number>) {
  const byId = new Map<string, AccountNode>(accounts.map((a) => [a.id, {
    ...a, children: [], depth: 0, path: '', net: net.get(a.id) ?? 0, treeNetBase: treeBase.get(a.id) ?? 0,
  }]))
  const roots: AccountNode[] = []
  for (const n of byId.values()) {
    const p = n.parent_id ? byId.get(n.parent_id) : undefined
    if (p) p.children.push(n)
    else roots.push(n)
  }
  const sort = (nodes: AccountNode[], depth: number, path: string) => {
    nodes.sort((a, b) => ACCOUNT_TYPES.indexOf(a.type) - ACCOUNT_TYPES.indexOf(b.type) || compareCodes(a.code, b.code))
    for (const n of nodes) {
      n.depth = depth
      n.path = path
      sort(n.children, depth + 1, path ? `${path} › ${n.name}` : n.name)
    }
  }
  sort(roots, 0, '')
  return { roots, byId }
}

/**
 * Leaf accounts with the same parent, name, kind and currency but different owners (no owner counts as one, "unknown") fold into one
 * display row (children = the owners' accounts), so a family's three wallets read as one "Cüzdan".
 */
export function mergePersonAccounts(nodes: AccountNode[]): AccountNode[] {
  const key = (n: AccountNode) => (!n.is_placeholder && !n.children.length
    ? [n.parent_id, n.name, n.currency, n.subtype].join('|') : null)
  const groups = new Map<string, AccountNode[]>()
  for (const n of nodes) {
    const k = key(n)
    if (k) groups.set(k, [...(groups.get(k) ?? []), n])
  }
  const out: AccountNode[] = []
  const done = new Set<string>()
  for (const n of nodes) {
    const k = key(n)
    const g = k ? groups.get(k)! : []
    if (g.length < 2 || new Set(g.map((x) => x.owner_member_id ?? '')).size < 2) {
      out.push({ ...n, children: mergePersonAccounts(n.children) })
    } else if (!done.has(k!)) {
      done.add(k!)
      out.push({
        ...n,
        id: `person-group:${n.parent_id}:${n.name}:${n.currency}`,
        owner_member_id: null,
        personGroup: true,
        net: g.reduce((s, x) => s + x.net, 0),
        treeNetBase: g.reduce((s, x) => s + x.treeNetBase, 0),
        children: g.map((c) => ({ ...c, depth: c.depth + 1 })),
      })
    }
  }
  return out
}

export const flattenTree = (nodes: AccountNode[]): AccountNode[] => nodes.flatMap((n) => [n, ...flattenTree(n.children)])

/** "Varlık:Banka:Yapıkredi Vadesiz TL" style full name (GnuCash). */
export function fullName(a: AccountNode | Account, byId: Map<string, AccountNode>): string {
  const parts = [a.name]
  let p = a.parent_id ? byId.get(a.parent_id) : undefined
  while (p) {
    parts.unshift(p.name)
    p = p.parent_id ? byId.get(p.parent_id) : undefined
  }
  return parts.join(':')
}

export function useLedgerAccounts() {
  return useQuery({
    queryKey: ['ledger', 'accounts'],
    queryFn: async () => {
      const [acc, bal, tree] = await Promise.all([
        supabase.from('accounts')
          .select('id, parent_id, code, name, type, subtype, currency, owner_member_id, is_placeholder, system_key, template_key, locked, archived_at'),
        supabase.from('account_balances').select('account_id, net_amount'),
        supabase.from('account_tree_balances').select('account_id, net_base_amount'),
      ])
      if (acc.error) throw acc.error
      if (bal.error) throw bal.error
      if (tree.error) throw tree.error
      const net = new Map(bal.data.map((b) => [b.account_id as string, Number(b.net_amount)]))
      const treeBase = new Map(tree.data.map((b) => [b.account_id as string, Number(b.net_base_amount)]))
      return buildAccountTree(acc.data as Account[], net, treeBase)
    },
  })
}

export type Member = { id: string; name: string; role: 'admin' | 'member'; avatarPath: string | null }

export function useMembers() {
  return useQuery({
    queryKey: ['ledger', 'members'],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase.from('members').select('id, user_id, role')
      if (error) throw error
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, avatar_url')
      const byUser = new Map((profiles ?? []).map((p) => [p.id as string, p]))
      return data.map((m) => {
        const p = byUser.get(m.user_id as string)
        return {
          id: m.id as string, name: (p?.display_name as string | null) ?? '—', role: m.role as Member['role'],
          avatarPath: (p?.avatar_url as string | null) ?? null,
        }
      })
    },
  })
}

export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('currencies').select('code, exponent').order('code')
      if (error) throw error
      return data as { code: string; exponent: number }[]
    },
  })
}

// Amounts for accountants: grouped digits, fixed decimals, no currency sign (the column says it).
export function formatAmount(minor: number, exponent: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: exponent, maximumFractionDigits: exponent })
    .format(minor / 10 ** exponent)
}

/** User input "1.234,56" or "1234.56" → decimal string for the API ("1234.56"); null when invalid. */
export function parseDecimalInput(s: string, exponent: number): string | null {
  let v = s.trim().replace(/\s/g, '')
  if (!v) return null
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.')
  const m = /^(\d+)(?:\.(\d+))?$/.exec(v)
  if (!m || (m[2]?.length ?? 0) > exponent) return null
  return m[2] ? `${m[1]}.${m[2]}` : m[1]
}

/** Decimal string → minor units (number; display and live totals only, the server recomputes). */
export function toMinor(decimal: string, exponent: number): number {
  const [i, f = ''] = decimal.split('.')
  return Number(i + f.padEnd(exponent, '0'))
}
