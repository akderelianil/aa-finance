import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Membership = {
  id: string
  role: 'admin' | 'member'
  group: { id: string; name: string; base_currency: string; lock_date: string | null; kind: 'family' | 'group'; avatar_url: string | null }
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

// Kullanıcının grup üyeliği. null = henüz bir gruba üye değil (onboarding gerekir).
export function useMembership(userId: string | undefined) {
  return useQuery({
    queryKey: ['membership', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Membership | null> => {
      const { data, error } = await supabase
        .from('members')
        .select('id, role, group:groups(id, name, base_currency, lock_date, kind, avatar_url)')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const { data: profile } = await supabase.from('profiles').select('display_name, first_name, last_name, avatar_url').eq('id', userId!).maybeSingle()
      const group = data.group as unknown as Membership['group']
      return {
        id: data.id, role: data.role, group, displayName: profile?.display_name ?? null,
        firstName: profile?.first_name ?? null, lastName: profile?.last_name ?? null, avatarUrl: profile?.avatar_url ?? null,
      }
    },
  })
}
