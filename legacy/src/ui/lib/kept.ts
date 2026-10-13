// Per-member state kept in memory until the app quits: open dialogs and draft form values.
// A member's tree is unmounted on a switch (Base UI modal dialogs make the rest of the page inert), so
// anything worth keeping lives here, keyed by member id, and is read back when that member's tree mounts.
// Flow: docs/product-designer/ux/pin.md.
import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction } from 'react'

const store = new Map<number, Map<string, unknown>>()

export const getKept = (id: number, slot: string): unknown => store.get(id)?.get(slot)
export function setKept(id: number, slot: string, value: unknown) {
  const m = store.get(id) ?? new Map<string, unknown>()
  m.set(slot, value)
  store.set(id, m)
}
/** Drop one member's slots that start with `prefix` ('' = all of them). */
export function clearKept(id: number, prefix = '') {
  const m = store.get(id)
  if (!m) return
  for (const k of m.keys()) if (k.startsWith(prefix)) m.delete(k)
  if (!m.size) store.delete(id)
}

/** The member whose tree this is; set once in MemberSpace. */
export const MemberContext = createContext<number | null>(null)

/** `useState` that mirrors its value into the signed-in member's kept state and starts from it. */
export function useKept<T>(slot: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const id = useContext(MemberContext)
  const [value, setValue] = useState<T>(() => {
    const kept = id === null ? undefined : getKept(id, slot)
    return kept !== undefined ? (kept as T) : initial instanceof Function ? initial() : initial
  })
  useEffect(() => { if (id !== null) setKept(id, slot, value) }, [id, slot, value])
  return [value, setValue]
}
