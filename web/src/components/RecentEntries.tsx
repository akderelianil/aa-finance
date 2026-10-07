import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export type EntryRow = {
  id: string
  memberId: string
  entry_date: string
  kind: 'expense' | 'income'
  category: string
  contact: string
  amount: string // ondalık string, para birimi üyenin grup ana para birimi
  editable: boolean // 2 satırlı gider/gelir; diğerleri şimdilik sadece görüntülenir
}

type RawEntry = {
  id: string
  member_id: string
  entry_date: string
  journal_lines: { amount: number; direction: string; account: { name: string; type: string }; contact: { name: string } | null }[]
}

// Minor unit (number, < 2^53 pratikte) → ondalık string. Gösterim için; hesap için kullanılmaz.
function fromMinor(minor: number, exponent: number): string {
  const s = String(minor).padStart(exponent + 1, '0')
  return exponent ? `${s.slice(0, -exponent)}.${s.slice(-exponent)}` : s
}

export function RecentEntries({
  membership, exponent, onEdit,
}: { membership: Membership; exponent: number; onEdit: (e: EntryRow) => void }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const groupId = membership.group.id

  const entries = useQuery({
    queryKey: ['entries', groupId],
    queryFn: async (): Promise<EntryRow[]> => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, member_id, entry_date, journal_lines(amount, direction, account:accounts(name, type), contact:contacts(name))')
        .eq('group_id', groupId).is('deleted_at', null)
        .or('source_type.is.null,source_type.neq.opening_balance')
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false })
        .limit(30)
        .overrideTypes<RawEntry[]>()
      if (error) throw error
      return data.map((e) => {
        const cat = e.journal_lines.find((l) => l.account.type === 'expense' || l.account.type === 'income')
        const kind = cat?.account.type === 'income' ? 'income' : 'expense'
        return {
          id: e.id,
          memberId: e.member_id,
          entry_date: e.entry_date,
          kind,
          category: cat?.account.name ?? '—',
          contact: e.journal_lines.find((l) => l.contact)?.contact?.name ?? '',
          amount: fromMinor(cat?.amount ?? 0, exponent),
          editable: e.journal_lines.length === 2 && !!cat,
        }
      })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => callFunction('transaction-delete', { entry_id: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entries', groupId] }),
  })

  const fmt = new Intl.NumberFormat(i18n.language, { style: 'currency', currency: membership.group.base_currency })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('entry.recent')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {entries.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('entry.empty')}</p>}
        {entries.data?.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-b-0">
            <div className="min-w-0">
              <p className="truncate font-medium">{e.category}</p>
              <p className="truncate text-xs text-muted-foreground">
                {e.entry_date}{e.contact && ` · ${e.contact}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className={e.kind === 'income' ? 'text-green-600' : ''}>
                {e.kind === 'income' ? '+' : '−'}{fmt.format(Number(e.amount))}
              </span>
              {e.memberId === membership.id && e.editable && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(e)}>{t('entry.edit')}</Button>
                  <Button
                    size="sm" variant="ghost" disabled={remove.isPending}
                    onClick={() => { if (window.confirm(t('entry.confirmDelete'))) remove.mutate(e.id) }}
                  >
                    {t('entry.delete')}
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
        <FormError message={remove.error ? errorMessage(t, remove.error) : entries.error ? errorMessage(t, entries.error) : null} />
      </CardContent>
    </Card>
  )
}
