import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Membership } from '@/auth/useMembership'
import { canModify, useMemberAccess } from './access'

// "Viewing as" another family member: the Journal shows that member's entries, and new entries are booked in their name
// when the admin gave you edit access (member_access). The server decides; this only hides buttons.
type ViewAs = {
  /** Member whose entries are shown; the signed-in member by default. */
  activeId: string
  /** True while another member is selected. */
  other: boolean
  /** May the signed-in member create entries for the active member? */
  canCreate: boolean
  setActiveId: (id: string) => void
}

const Ctx = createContext<ViewAs | null>(null)
const key = (memberId: string) => `viewAs:${memberId}`

function stored(memberId: string) {
  try { return localStorage.getItem(key(memberId)) || memberId } catch { return memberId }
}

export function ViewAsProvider({ membership, children }: { membership: Membership; children: ReactNode }) {
  const [activeId, setActive] = useState(() => stored(membership.id))
  const access = useMemberAccess()
  const setActiveId = useCallback((id: string) => {
    setActive(id)
    try { localStorage.setItem(key(membership.id), id) } catch { /* private window */ }
  }, [membership.id])
  const value = useMemo<ViewAs>(() => ({
    activeId, other: activeId !== membership.id, setActiveId,
    canCreate: activeId === membership.id || canModify(membership, access.data ?? [], activeId, 'edit'),
  }), [activeId, membership, access.data, setActiveId])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useViewAs() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useViewAs outside ViewAsProvider')
  return v
}

/** Body field for journal-post: only set when booking for another member. */
export function useOnBehalf() {
  const v = useViewAs()
  return v.other ? { member_id: v.activeId } : {}
}
