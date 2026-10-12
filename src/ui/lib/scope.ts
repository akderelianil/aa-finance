// The Aile / Kişi scope: whose accounts a page shows. One choice for Reports, Yevmiye and Hesap Planı,
// kept on this device. 'family' = everyone, 'shared' = Ortak (no owner), else a member id.
import { useMemo, useSyncExternalStore } from 'react'
import type { Account } from '../../core/api/accounts.ts'

const KEY = 'aa-finance.scope'
export type Scope = 'family' | 'shared' | `${number}`

let scope: Scope = (() => { try { return (localStorage.getItem(KEY) as Scope | null) ?? 'family' } catch { return 'family' } })()
const listeners = new Set<() => void>()

export function setScope(next: Scope) {
  scope = next
  try { localStorage.setItem(KEY, next) } catch { /* this session only */ }
  listeners.forEach((l) => l())
}

/** The scope as the API's `owner` input: undefined = the whole family. */
export const ownerOf = (s: Scope): number | 'shared' | undefined => (s === 'family' ? undefined : s === 'shared' ? 'shared' : Number(s))

/** Current scope and its `owner` input. A member that no longer exists falls back to Aile (pass `known` ids). */
export function useScope(known?: number[]) {
  const raw = useSyncExternalStore((l) => (listeners.add(l), () => void listeners.delete(l)), () => scope)
  const current: Scope = known && raw !== 'family' && raw !== 'shared' && !known.includes(Number(raw)) ? 'family' : raw
  return { scope: current, owner: ownerOf(current) }
}

/**
 * Accounts for a scope: other owners' accounts lose their balance and drop out unless they are
 * system accounts or hold a kept account below them, so the tree still rolls up.
 */
export function useScopedAccounts(accounts: Account[] | undefined, owner: number | 'shared' | undefined) {
  return useMemo(() => {
    if (!accounts || owner === undefined) return accounts
    const mine = (a: Account) => (owner === 'shared' ? a.owner === null : a.owner === owner)
    const byId = new Map(accounts.map((a) => [a.id, a]))
    const keep = new Set<number>()
    for (const a of accounts) {
      if (!mine(a) || a.placeholder) continue
      for (let p: Account | undefined = a; p && !keep.has(p.id); p = p.parent ? byId.get(p.parent) : undefined) keep.add(p.id)
    }
    return accounts
      .filter((a) => keep.has(a.id) || a.locked)
      .map((a) => (mine(a) && !a.placeholder ? a : { ...a, balance: 0, baseBalance: 0 }))
  }, [accounts, owner])
}
