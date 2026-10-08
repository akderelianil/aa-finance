import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowRightIcon, ArrowUpRightIcon, PaperclipIcon, PencilIcon, ReceiptTextIcon, SearchIcon,
  Trash2Icon,
} from 'lucide-react'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { EntryAttachments } from '@/components/EntryAttachments'
import { useGroupTags } from '@/lib/entry'
import { OptionSelect } from '@/components/OptionSelect'
import { useEntryDialog } from '@/components/EntryDialog'
import { FormError } from '@/components/PageShell'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  parts: { category: string; amount: string }[] // kategori satırları (ilki ana kategori, diğerleri kalemler)
  editable: boolean // tek hesaplı, ana para birimli gider/gelir; diğerleri şimdilik sadece görüntülenir
  tags: string[]
}

type RawEntry = {
  id: string
  member_id: string
  entry_date: string
  source_type: string | null
  tags: { tag: { name: string } }[]
  journal_lines: { amount: number; base_amount: number; currency: string; direction: string; account: { name: string; type: string; subtype: string | null; system_key: string | null }; contact: { name: string } | null }[]
}

const PAGE = 30

const DIRECTION = {
  income: { icon: ArrowDownLeftIcon, sign: '+', className: 'text-success', chip: 'bg-success/10 text-success', badge: 'success' },
  expense: { icon: ArrowUpRightIcon, sign: '−', className: 'text-destructive', chip: 'bg-destructive/10 text-destructive', badge: 'destructive' },
  other: { icon: ArrowLeftRightIcon, sign: '', className: 'text-muted-foreground', chip: 'bg-muted text-muted-foreground', badge: 'secondary' },
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
  const [tag, setTag] = useState('')
  const [deleting, setDeleting] = useState<EntryRow | null>(null)
  // Etiket seçiliyse o etiketin bütün kayıtları gelir (toplam doğru olsun).
  const fetchCount = full ? (tag ? 1000 : count) : limit
  const groupTags = useGroupTags(groupId)

  const entries = useQuery({
    queryKey: ['entries', groupId, fetchCount, tag],
    queryFn: async (): Promise<EntryRow[]> => {
      const base = 'id, member_id, entry_date, source_type, tags:entry_tags(tag:tags(name)), journal_lines(amount, base_amount, currency, direction, account:accounts(name, type, subtype, system_key), contact:contacts(name))'
      let query = supabase.from('journal_entries').select(tag ? `${base}, tf:entry_tags!inner(tag_id)` : base)
      if (tag) query = query.eq('tf.tag_id', tag)
      const { data, error } = await query
        .eq('group_id', groupId).is('deleted_at', null)
        .or('source_type.is.null,source_type.neq.opening_balance')
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false })
        .order('position', { referencedTable: 'journal_lines' })
        .limit(fetchCount)
        .overrideTypes<RawEntry[]>()
      if (error) throw error
      return data.map((e) => {
        // Sistem kategorileri (kur farkı, yatırım kâr/zarar) ve özel kayıt türleri başlık sayılmaz.
        // Çok kalemli kayıtta (market: gıda + alkol) her kategori ayrı satırdır; başlık ve tutar hepsini kapsar.
        const cats = e.source_type && e.source_type !== 'installment' ? []
          : e.journal_lines.filter((l) => !l.account.system_key && (l.account.type === 'expense' || l.account.type === 'income'))
        const cat = cats[0]
        // Paylaşılan giderde birden çok kişi olabilir.
        const contact = [...new Set(e.journal_lines.flatMap((l) => (l.contact ? [l.contact.name] : [])))].join(', ')
        const first = e.journal_lines[0]
        let kind: EntryRow['kind'] = cat ? (cat.account.type === 'income' ? 'income' : 'expense') : 'other'
        let category = cat ? [...new Set(cats.map((l) => l.account.name))].join(', ') : '—'
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
        } else if (!cat && (e.source_type === 'deposit_open' || e.source_type === 'deposit')) {
          const dep = e.journal_lines.find((l) => l.account.subtype === 'deposit')?.account.name
          category = `${t(e.source_type === 'deposit' ? 'entry.deposit.settled' : 'entry.deposit.opened')}: ${dep}`
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
          amount: fromMinor(cat ? cats.reduce((s, l) => s + Number(l.base_amount), 0) : (first?.base_amount ?? 0), exponent),
          parts: cats.map((l) => ({ category: l.account.name, amount: fromMinor(l.base_amount, exponent) })),
          editable: !e.source_type && !!cat && e.journal_lines.length === cats.length + 1
            && e.journal_lines.every((l) => l.currency === membership.group.base_currency),
          tags: e.tags.map((x) => x.tag.name).sort(),
        }
      })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => callFunction('transaction-delete', { entry_id: id }),
    onSuccess: () => { setDeleting(null); void queryClient.invalidateQueries() },
  })

  const fmt = new Intl.NumberFormat(i18n.language, { style: 'currency', currency: membership.group.base_currency })
  const dayFmt = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: full ? 'numeric' : undefined })

  const q = search.trim().toLocaleLowerCase(i18n.language)
  const rows = (entries.data ?? []).filter((e) =>
    (kinds.length === 0 || kinds.includes(e.kind))
    && (!q || `${e.category} ${e.contact} ${e.tags.join(' ')}`.toLocaleLowerCase(i18n.language).includes(q)))
  const tagName = groupTags.data?.find((x) => x.id === tag)?.name
  const sum = (k: EntryRow['kind']) => rows.filter((e) => e.kind === k).reduce((s, e) => s + Number(e.amount), 0)

  function row(e: EntryRow) {
    const mine = e.memberId === membership.id
    const dir = DIRECTION[e.kind]
    const Icon = dir.icon
    return (
      <Fragment key={e.id}>
        <TableRow>
          <TableCell className="w-px whitespace-nowrap text-muted-foreground">{dayFmt.format(new Date(`${e.entry_date}T00:00:00`))}</TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl', dir.chip)} aria-hidden>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{e.category}</p>
                {(e.contact || e.original || e.tags.length > 0) && (
                  <p className="truncate text-xs text-muted-foreground">
                    {[e.contact, e.original].filter(Boolean).join(' · ')}
                    {e.tags.map((name) => (
                      <span key={name} className="ml-1.5 text-primary">#{name}</span>
                    ))}
                  </p>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell className="hidden sm:table-cell">
            <Badge variant={dir.badge}>{t(`journal.kind.${e.kind}`)}</Badge>
          </TableCell>
          <TableCell className={cn('text-right font-medium whitespace-nowrap tabular-nums', dir.className)}>
            {dir.sign}{fmt.format(Number(e.amount))}
          </TableCell>
          <TableCell className="w-px">
            <div className="flex justify-end">
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
          </TableCell>
        </TableRow>
        {openId === e.id && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5}><EntryAttachments entryId={e.id} canEdit={mine} /></TableCell>
          </TableRow>
        )}
      </Fragment>
    )
  }

  const canLoadMore = full && (entries.data?.length ?? 0) >= count

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptTextIcon className="size-4 text-muted-foreground" aria-hidden />
          {t(full ? 'journal.title' : 'entry.recent')}
        </CardTitle>
        {!full && (
          <CardAction>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/yevmiye" />}>
              {t('dashboard.allEntries')}<ArrowRightIcon data-icon="inline-end" />
            </Button>
          </CardAction>
        )}
      </CardHeader>
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
            {(groupTags.data?.length ?? 0) > 0 && (
              <OptionSelect
                value={tag} onChange={setTag} label={t('journal.tag')} className="sm:w-44"
                options={[{ value: '', label: t('journal.allTags') }, ...groupTags.data!.map((x) => ({ value: x.id, label: `#${x.name}` }))]}
              />
            )}
          </div>
        )}
        {full && tagName && entries.data && (
          <p className="text-sm text-muted-foreground">
            {t('journal.tagTotal', { tag: tagName, expense: fmt.format(sum('expense')), income: fmt.format(sum('income')) })}
          </p>
        )}
        {entries.isLoading && (
          <div className="flex flex-col gap-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        )}
        {entries.data && rows.length === 0 && (
          <Empty><EmptyHeader><EmptyTitle>{t('entry.empty')}</EmptyTitle>
            {full && (search || kinds.length > 0 || tag) && <EmptyDescription>{t('journal.noMatch')}</EmptyDescription>}
          </EmptyHeader></Empty>
        )}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('journal.col.date')}</TableHead>
                <TableHead>{t('journal.col.entry')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('journal.col.kind')}</TableHead>
                <TableHead className="text-right">{t('journal.col.amount')}</TableHead>
                <TableHead><span className="sr-only">{t('accounts.actions')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{rows.map(row)}</TableBody>
          </Table>
        )}
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
