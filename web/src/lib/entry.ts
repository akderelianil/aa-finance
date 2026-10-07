import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { toast } from '@/components/ui/toast'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export const AMOUNT = '[0-9]+([.,][0-9]+)?'
export const today = () => new Date().toLocaleDateString('sv-SE')
export const decimal = (v: string) => v.replace(',', '.')

// Paylaştır satırı. share: '' (eşit) · '185,78' (tutar) · '%20' (yüzde)
export type SplitRow = { name: string; share: string }

// İstek gövdesi: boş isimler atılır; "%20" → percent, "185,78" → amount.
export function splitPayload(rows: SplitRow[]) {
  return rows.filter((r) => r.name.trim()).map((r) => {
    const s = r.share.trim().replace(',', '.')
    if (!s) return { name: r.name.trim() }
    return s.includes('%') ? { name: r.name.trim(), percent: s.replace('%', '').trim() } : { name: r.name.trim(), amount: s }
  })
}

export type MyAccount = { id: string; name: string; currency: string; subtype: string | null }

// Üyenin kayıt atılabilir kendi hesapları (varlık + borç), açılış sırasıyla.
export function useMyAccounts(membership: Membership) {
  return useQuery({
    queryKey: ['accounts', membership.group.id, 'mine'],
    queryFn: async (): Promise<MyAccount[]> => {
      const { data, error } = await supabase
        .from('accounts').select('id, name, currency, subtype')
        .eq('owner_member_id', membership.id).in('type', ['asset', 'liability']).is('system_key', null)
        .eq('is_placeholder', false).is('archived_at', null).order('created_at')
      if (error) throw error
      return data
    },
  })
}

// Kayıttan sonra: verileri tazele ve "Kaydedildi · Geri al" bildirimi göster.
// Geri al = kaydı sil (çok satırlı kayıt ve bağlı taksit planı tek adımda gider).
export function useAfterSave() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useCallback((entryId: string) => {
    void queryClient.invalidateQueries()
    const id = toast.add({
      title: t('entry.saved'),
      type: 'success',
      timeout: 8000,
      actionProps: {
        children: t('entry.undo'),
        onClick: () => {
          toast.close(id)
          callFunction('transaction-delete', { entry_id: entryId })
            .then(() => {
              void queryClient.invalidateQueries()
              toast.add({ title: t('entry.undone'), timeout: 3000 })
            })
            .catch((err: unknown) => toast.add({ title: errorMessage(t, err), type: 'error' }))
        },
      },
    })
  }, [queryClient, t])
}
