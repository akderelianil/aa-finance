// Who is working: in memory only (the backend binds the actor on members.signIn).
// A reload or app restart locks. Only the last member's id stays on the device, to preselect on the pick screen.
// Flow: docs/product-designer/ux/pin.md.
import { useSyncExternalStore } from 'react'
import { lockApi } from './api.ts'

/** Idle lock: no keyboard or pointer input for this long. Fixed (no setting). */
export const IDLE_MS = 5 * 60 * 1000

const LAST_KEY = 'aa-finance.member'
export const lastMember = () => { try { return Number(localStorage.getItem(LAST_KEY)) || null } catch { return null } }

type Session = {
  /** The signed-in member; null = locked or not yet in. */
  signedIn: number | null
  /** Set by the idle lock: the lock screen is for this member and their open screen stays mounted. */
  lockedFor: number | null
  /** member id → epoch ms when the PIN wait ends (known from this run only). */
  waits: Record<number, number>
}

let session: Session = { signedIn: null, lockedFor: null, waits: {} }
const listeners = new Set<() => void>()
function set(patch: Partial<Session>) {
  session = { ...session, ...patch }
  listeners.forEach((l) => l())
}

export const useSession = () => useSyncExternalStore((l) => (listeners.add(l), () => void listeners.delete(l)), () => session)

export function signedIn(id: number) {
  try { localStorage.setItem(LAST_KEY, String(id)) } catch { /* private window: this session only */ }
  set({ signedIn: id, lockedFor: null })
}

/** Lock the app. `idle` keeps the member's screen for the same member's PIN; a switch drops it. */
export function lock(idle: boolean) {
  lockApi()
  set({ signedIn: null, lockedFor: idle ? session.signedIn : null })
}

/** From the lock screen to the pick screen. */
export const dropLock = () => set({ lockedFor: null })

export const setWait = (id: number, seconds: number) => set({ waits: { ...session.waits, [id]: Date.now() + seconds * 1000 } })
export function clearWait(id: number) {
  const { [id]: _, ...rest } = session.waits
  set({ waits: rest })
}

// Per member, kept until the app quits. Open screen only: dialogs and drafts live in the mounted screen,
// so they survive an idle lock but not a member switch (see pin.md, open points).
// An admin PIN reset drops the member's saved state.
const saved = new Map<number, string>()
export const savedPath = (id: number) => saved.get(id)
export const savePath = (id: number, path: string) => void saved.set(id, path)
export const forgetState = (id: number) => void saved.delete(id)

/** Seconds left of a wait, ticking each second; 0 when none. */
export function useWaitLeft(id: number | null): number {
  const until = useSession().waits[id ?? -1]
  const sub = (l: () => void) => {
    if (!until) return () => {}
    const timer = setInterval(l, 500)
    return () => clearInterval(timer)
  }
  const left = useSyncExternalStore(sub, () => (until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0))
  return left
}

/** Current time in whole seconds, re-rendering each second while any PIN wait is known. */
export function useNowSeconds(): number {
  const any = Object.keys(useSession().waits).length > 0
  const sub = (l: () => void) => {
    if (!any) return () => {}
    const timer = setInterval(l, 500)
    return () => clearInterval(timer)
  }
  return useSyncExternalStore(sub, () => Math.floor(Date.now() / 1000))
}
