import { useQuery } from '@tanstack/react-query'
import { callFunction } from '@/lib/api'
import { supabase } from '@/lib/supabase'

// The avatars bucket is private (only the group sees its photos): show a signed URL, renewed before it expires.
const TTL = 60 * 60
export function useAvatarSrc(path: string | null | undefined): string | undefined {
  const { data } = useQuery({
    queryKey: ['avatar', path],
    enabled: !!path,
    staleTime: (TTL - 300) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path!, TTL)
      if (error) throw error
      return data.signedUrl
    },
  })
  return path ? data : undefined
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'
}

// Görseli imzalı URL ile yükler, kayıtlı yolu döndürür (profile-update / group-update'e verilir).
export async function uploadAvatar(target: 'user' | 'group', file: File): Promise<string> {
  const { path, token } = await callFunction<{ path: string; token: string }>('avatar-upload', {
    target, mime_type: file.type,
  })
  const { error } = await supabase.storage.from('avatars').uploadToSignedUrl(path, token, file)
  if (error) throw error
  return path
}
