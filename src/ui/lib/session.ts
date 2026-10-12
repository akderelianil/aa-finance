// Who is working this session: one flag, kept in sessionStorage so a reload stays signed in
// and a new app start asks again. No PIN; "signed in" only means a user was picked.
import { useSyncExternalStore } from 'react'

const KEY = 'aa-finance.picked'
let picked = (() => { try { return sessionStorage.getItem(KEY) === '1' } catch { return false } })()
const listeners = new Set<() => void>()

function set(v: boolean) {
  picked = v
  try { v ? sessionStorage.setItem(KEY, '1') : sessionStorage.removeItem(KEY) } catch { /* this session only */ }
  listeners.forEach((l) => l())
}

export const markPicked = () => set(true)
/** Sign out: back to the user selection screen. */
export const signOut = () => set(false)

export function usePicked() {
  return useSyncExternalStore((l) => (listeners.add(l), () => void listeners.delete(l)), () => picked)
}
