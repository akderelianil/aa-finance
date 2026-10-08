import { useQuery } from '@tanstack/react-query'
import type { Membership } from '@/auth/useMembership'
import { supabase } from './supabase'

// Who may change whose journal entries (table member_access). No row = view only. Owner and admin always may.
export type AccessLevel = 'view' | 'edit' | 'delete'
export type AccessRow = { member_id: string; target_member_id: string; level: 'edit' | 'delete' }

export function useMemberAccess() {
  return useQuery({
    queryKey: ['ledger', 'member-access'],
    queryFn: async (): Promise<AccessRow[]> => {
      const { data, error } = await supabase.from('member_access').select('member_id, target_member_id, level')
      if (error) throw error
      return data as AccessRow[]
    },
  })
}

export function levelOf(rows: AccessRow[], memberId: string, targetId: string): AccessLevel {
  return rows.find((r) => r.member_id === memberId && r.target_member_id === targetId)?.level ?? 'view'
}

/** Mirrors canModify in supabase/functions/_shared/entries.ts; the server decides, this only hides buttons. */
export function canModify(m: Membership, rows: AccessRow[], ownerId: string, need: 'edit' | 'delete'): boolean {
  if (m.id === ownerId || m.role === 'admin') return true
  const level = levelOf(rows, m.id, ownerId)
  return level === 'delete' || (level === 'edit' && need === 'edit')
}
