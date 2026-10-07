import { callFunction } from '@/lib/api'
import { supabase } from '@/lib/supabase'

export function avatarSrc(path: string | null | undefined): string | undefined {
  return path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : undefined
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
