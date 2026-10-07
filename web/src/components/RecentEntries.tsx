import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowUpRightIcon, PaperclipIcon, PencilIcon, SearchIcon, Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { EntryAttachments } from '@/components/EntryAttachments'
import { useEntryDialog } from '@/components/EntryDialog'
import { FormError } from '@/components/PageShell'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export type EntryRow = {
  id: string
  memberId: string
  entry_date: string
  kind: 'expense' | 'income' | 'other'
  category: string
  contact: string
  original: string // yabancı para satırı ise orijinal tutar (biçimli), değilse ''
  amount: string // ondalık string, para birimi üyenin grup ana para birimi
  editable: boolean // 2 satırlı gider/gelir; diğerleri şimdilik sadece görüntülenir
}

type RawEntry = {
  id: string
  member_id: string
  entry_date: string
  source_type: string | null
  journal_lines: { amount: number; base_amount: number; currency: string; direction: string; account: { name: string; type: string; subtype: string | null; system_key: string | null }; contact: { name: string } | null }[]
}

const PAGE = 30

const DIRECTION = {
  income: { icon: ArrowDownLeftIcon, sign: '+', className: 'text-emerald-700 dark:text-emerald-400' },
  expense: { icon: ArrowUpRightIcon, sign: '−', className: 'text-rose-700 dark:text-rose-400' },
  other: { icon: ArrowLeftRightIcon, sign: '', className: 'text-muted-foreground' },
} as const

// Minor unit (number, < 2^53 pratikte) → ondalık string. Gösterim için; hesap için kullanılmaz.
function fromMinor(minor: number, exponent: number): string {
  const s = String(minor).padStart(exponent + 1, '0')
  return exponent ? `${s.slice(0, -exponent)}.${s.slice(-exponent)}` : s
}

type Props = {
  membership: Membership
  exponent: number
  // Panoda: ilk N kayıt, filtre/sayfalama yok. İşlemler sayfasında: filtreler + "daha fazla".
  limit?: number
}

export function RecentEntries({ membership, exponent, limit }: Props) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { open: openEntry } = useEntryDialog()
  const groupId = membership.group.id
  const full = limit === undefined
  const [count, setCount] = useState(PAGE)
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [kinds, setKinds] = useState<string[]>([])
  const [deleting, setDeleting] = useState<EntryRow | null>(null)
  const fetchCount = full ? count : limit

  const entries = useQuery({
    queryKey: ['entries', groupId, fetchCount],
    queryFn: async (): Promise<EntryRow[]> => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, member_id, entry_date, source_type, journal_lines(amount, base_amount, currency, direction, account:accounts(name, type, subtype, system_key), contact:contacts(name))')
        .eq('group_id', groupId).is('deleted_at', null)
        .or('source_type.is.null,source_type.neq.opening_balance')
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false })
        .limit(fetchCount)
        .overrideTypes<RawEntry[]>()
      if (error) throw error
      return data.map((e) => {
        // Sistem kategorileri (kur farkı, yatırım kâr/zarar) ve özel kayıt türleri başlık sayılmaz.
        const cat = e.source_type && e.source_type !== 'installment' ? undefined
          : e.journal_lines.find((l) => !l.account.system_key && (l.account.type === 'expense' || l.account.type === 'income'))
        // Paylaşılan giderde birden çok kişi olabilir.
        const contact = [...new Set(e.journal_lines.flatMap((l) => (l.contact ? [l.contact.name] : [])))].join(', ')
        const first = e.journal_lines[0]
        let kind: EntryRow['kind'] = cat ? (cat.account.type === 'income' ? 'income' : 'expense') : 'other'
        let category = cat?.account.name ?? '—'
        if (!cat && e.source_type === 'transfer') {
          const from = e.journal_lines.find((l) => l.direction === 'credit')?.account
          const to = e.journal_lines.find((l) => l.direction === 'debit')?.account
          // Banka ↔ nakit = ATM (kullanıcının dili).
          const atm = [from?.subtype, to?.subtype].sort().join() === 'bank,cash'
          category = `${t(atm ? 'entry.kind.atm' : 'entry.transfer')}: ${from?.name} → ${to?.name}`
        } else if (!cat && (e.source_type === 'investment' || e.source_type === 'valuation')) {
          category = t(e.source_type === 'valuation' ? 'investments.valuation' : 'investments.title')
        } else if (!cat && e.source_type === 'fx_exchange') {
          category = t('accounts.exchange')
        } else if (!cat && e.source_type === 'loan') {
          category = `${t('entry.loan.label')}: ${contact}`
        } else if (!cat && e.source_type === 'cash_advance') {
          const from = e.journal_lines.find((l) => l.direction === 'credit')?.account.name
          category = `${t('entry.atm.advance')}: ${from}`
        } else if (!cat && e.source_type === 'installment_payment') {
          category = t('installments.pay')
        } else if (!cat && e.source_type === 'debt') {
          category = contact || t('people.debt')
        }
        if (!cat) kind = 'other'
        return {
          id: e.id,
          memberId: e.member_id,
          entry_date: e.entry_date,
          kind,
          category,
          contact: cat ? contact : '',
          original: cat && cat.currency !== membership.group.base_currency ? formatMinor(cat.amount, cat.currency, i18n.language) : '',
          amount: fromMinor((cat ?? first)?.base_amount ?? 0, exponent),
          editable: !e.source_type && e.journal_lines.length === 2 && !!cat && cat.currency === membership.group.base_currency && first.currency === membership.group.base_currency,
        }
      })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => callFunction('transaction-delete', { entry_id: id }),
    onSuccess: () => { setDeleting(null); void queryClient.invalidateQueries() },
  })

  const fmt = new Intl.NumberFormat(i18n.language, { style: 'currency', currency: membership.group.base_currency })
  const dayFmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })

  const q = search.trim().toLocaleLowerCase(i18n.language)
  const rows = (entries.data ?? []).filter((e) =>
    (kinds.length === 0 || kinds.includes(e.kind))
    && (!q || `${e.category} ${e.contact}`.toLocaleLowerCase(i18n.language).includes(q)))

  // Tarihe göre grupla (liste zaten tarih sırasında).
  const groups: { date: string; items: EntryRow[] }[] = []
  for (const e of rows) {
    const g = groups[groups.length - 1]
    if (g && g.date === e.entry_date) g.items.push(e)
    else groups.push({ date: e.entry_date, items: [e] })
  }

  function row(e: EntryRow) {
    const mine = e.memberId === membership.id
    return (
      <li key={e.id} className="flex flex-col">
        <div className="flex items-center gap-2 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{e.category}</p>
            {(e.contact || e.original) && (
              <p className="truncate text-xs text-muted-foreground">{[e.contact, e.original].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          {/* Yön üç işaretle: renk + ikon + (+/−). */}
          <span className={cn('flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums', DIRECTION[e.kind].className)}>
            {(() => { const Icon = DIRECTION[e.kind].icon; return <Icon className="size-4" aria-hidden /> })()}
            {DIRECTION[e.kind].sign}{fmt.format(Number(e.amount))}
          </span>
          <Button
            size="icon-sm" variant="ghost" aria-label={t('attachments.show')} aria-expanded={openId === e.id}
            onClick={() => setOpenId(openId === e.id ? null : e.id)}
          >
            <PaperclipIcon />
          </Button>
          {mine && e.editable && (
            <Button size="icon-sm" variant="ghost" aria-label={t('entry.edit')} onClick={() => openEntry(e)}><PencilIcon /></Button>
          )}
          {mine && (
            <Button size="icon-sm" variant="ghost" aria-label={t('entry.delete')} onClick={() => { remove.reset(); setDeleting(e) }}>
              <Trash2Icon />
            </Button>
          )}
        </div>
        {openId === e.id && <EntryAttachments entryId={e.id} canEdit={mine} />}
      </li>
    )
  }

  const canLoadMore = full && (entries.data?.length ?? 0) >= count

  return (
    <Card>
      {!full && (
        <CardHeader>
          <CardTitle>{t('entry.recent')}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-3">
        {full && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <InputGroup className="sm:max-w-xs">
              <InputGroupAddon><SearchIcon /></InputGroupAddon>
              <InputGroupInput
                type="search" value={search} placeholder={t('journal.search')} aria-label={t('journal.search')}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            <ToggleGroup multiple value={kinds} onValueChange={setKinds} spacing={2} aria-label={t('journal.filter')}>
              {(['expense', 'income', 'other'] as const).map((k) => (
                <ToggleGroupItem key={k} value={k} variant="outline" size="sm">{t(`journal.kind.${k}`)}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}
        {entries.isLoading && (
          <div className="flex flex-col gap-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        )}
        {entries.data && rows.length === 0 && (
          <Empty><EmptyHeader><EmptyTitle>{t('entry.empty')}</EmptyTitle>
            {full && (search || kinds.length > 0) && <EmptyDescription>{t('journal.noMatch')}</EmptyDescription>}
          </EmptyHeader></Empty>
        )}
        {groups.map((g) => (
          <section key={g.date} className="flex flex-col">
            <h3 className="pt-1 text-xs font-medium text-muted-foreground">{dayFmt.format(new Date(`${g.date}T00:00:00`))}</h3>
            <ul className="flex flex-col divide-y">{g.items.map(row)}</ul>
          </section>
        ))}
        {canLoadMore && (
          <Button variant="outline" disabled={entries.isFetching} onClick={() => setCount(count + PAGE)}>{t('journal.more')}</Button>
        )}
        <FormError message={entries.error ? errorMessage(t, entries.error) : null} />
      </CardContent>
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('entry.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.category}</AlertDialogDescription>
          </AlertDialogHeader>
          <FormError message={remove.error ? errorMessage(t, remove.error) : null} />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('entry.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive" disabled={remove.isPending}
              onClick={(e) => { e.preventDefault(); if (deleting) remove.mutate(deleting.id) }}
            >
              {t('entry.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
