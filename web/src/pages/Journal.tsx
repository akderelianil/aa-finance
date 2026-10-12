import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTable, type ColumnDef, type ExpandedState } from '@tanstack/react-table'
import { MoreHorizontalIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { MemberAvatar } from '@/components/coa/OwnerAvatars'
import { JournalEditor } from '@/components/journal/JournalEditor'
import { NewEntryChooser, type NewEntryChoice } from '@/components/journal/NewEntryChooser'
import { QuickTransactionDialog, type QuickKind } from '@/components/quick/QuickTransactionDialog'
import { PageHeader } from '@/components/PageHeader'
import { FormError } from '@/components/PageShell'
import { Badge } from '@/components/reui/badge'
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable, DataGridTableRowExpand } from '@/components/reui/data-grid/data-grid-table'
import { Frame, FrameFooter, FramePanel } from '@/components/reui/frame'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { callFunction } from '@/lib/api'
import { lineContacts, useContacts } from '@/lib/contacts'
import { errorMessage } from '@/lib/errors'
import { PAGE_SIZES, useGridI18n, useGridPages } from '@/lib/grid'
import { entryToDraft, newDraft, today, useJournalEntries, type Draft, type JournalEntry } from '@/lib/journal'
import { flattenTree, formatAmount, useCurrencies, useLedgerAccounts, useMembers, type AccountNode } from '@/lib/ledger'
import { canModify, useMemberAccess } from '@/lib/access'
import { useViewAs } from '@/lib/viewAs'

type Period = 'month' | 'lastMonth' | 'year' | 'custom'

const iso = (d: Date) => d.toLocaleDateString('sv')
function periodRange(p: Exclude<Period, 'custom'>): [string, string] {
  const n = new Date()
  if (p === 'month') return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), today()]
  if (p === 'lastMonth') return [iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), iso(new Date(n.getFullYear(), n.getMonth(), 0))]
  return [iso(new Date(n.getFullYear(), 0, 1)), today()]
}

// General Journal (GnuCash "General Journal"): one row per entry (date, description, accounts, amount).
// The debit/credit lines open on demand; edit and delete live in the row menu and the form in a dialog.
// The owner, the admin and members the admin allowed (member_access) edit or delete an entry.
export default function Journal({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const base = membership.group.base_currency
  const [period, setPeriod] = useState<Period>('month')
  const [custom, setCustom] = useState<[string, string]>(periodRange('month'))
  const [from, to] = period === 'custom' ? custom : periodRange(period)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [draft, setDraft] = useState<Draft | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [quick, setQuick] = useState<QuickKind | null>(null)
  const [deleting, setDeleting] = useState<JournalEntry | null>(null)

  const { activeId, other, canCreate } = useViewAs()
  const accounts = useLedgerAccounts()
  const members = useMembers()
  const access = useMemberAccess()
  const contacts = useContacts()
  const contactById = useMemo(() => new Map((contacts.data ?? []).map((c) => [c.id, c])), [contacts.data])
  const currencies = useCurrencies()
  const entries = useJournalEntries(from, to)
  const exponents = useMemo(() => new Map((currencies.data ?? []).map((c) => [c.code, c.exponent])), [currencies.data])
  const baseExp = exponents.get(base) ?? 2
  const byId = useMemo(() => accounts.data?.byId ?? new Map<string, AccountNode>(), [accounts.data])
  const postable = useMemo(
    () => flattenTree(accounts.data?.roots ?? []).filter((a) => !a.is_placeholder && !a.archived_at),
    [accounts.data],
  )
  const memberById = useMemo(() => new Map((members.data ?? []).map((m) => [m.id, m])), [members.data])
  const fmt = (minor: number, cur = base) => formatAmount(minor, exponents.get(cur) ?? 2, i18n.language)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ledger'] })

  // Newest first: the user came for what happened last.
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(i18n.language)
    const list = [...(entries.data ?? [])].reverse().filter((e) => !other || e.member_id === activeId)
    if (!q) return list
    const has = (s?: string | null) => (s ?? '').toLocaleLowerCase(i18n.language).includes(q)
    return list.filter((e) => has(e.description)
      || lineContacts(e.journal_lines, contactById).some(has)
      || e.journal_lines.some((l) => has(l.memo) || has(byId.get(l.account_id)?.name)))
  }, [entries.data, other, activeId, search, byId, contactById, i18n.language])

  const pages = useGridPages(visible.length, [from, to, search, activeId].join('|'), entries.isLoading)
  const gridI18n = useGridI18n()

  const volume = visible.reduce((s, e) => s + e.journal_lines.reduce((x, l) => x + (l.direction === 'debit' ? Number(l.base_amount) : 0), 0), 0)

  const accountsOf = (e: JournalEntry) => {
    const name = (side: 'debit' | 'credit') => [...new Set(e.journal_lines.filter((l) => l.direction === side).map((l) => byId.get(l.account_id)?.name ?? ''))]
    const [d, c] = [name('debit'), name('credit')]
    return d.length === 1 && c.length === 1 ? `${d[0]} → ${c[0]}` : t('gj.lines', { count: e.journal_lines.length })
  }

  function choose(c: NewEntryChoice) {
    setChoosing(false)
    if (c === 'free') setDraft(newDraft())
    else setQuick(c)
  }

  function edit(e: JournalEntry) { setDraft(entryToDraft(e, base, exponents)) }

  const columns = useMemo<ColumnDef<DataGridFeatures, JournalEntry>[]>(() => [
    {
      id: 'member',
      accessorFn: (e) => memberById.get(e.member_id)?.name ?? '',
      header: ({ column }) => <DataGridColumnHeader title={t('gj.user')} column={column} />,
      cell: ({ row }) => {
        const m = memberById.get(row.original.member_id)
        return (
          <div className="flex items-center gap-1">
            <DataGridTableRowExpand row={row} className="-ms-1.5 -me-1" />
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}><MemberAvatar member={m} /></TooltipTrigger>
              <TooltipContent>{m?.name ?? t('coa.unknownOwner')}</TooltipContent>
            </Tooltip>
          </div>
        )
      },
      size: 90,
      enableHiding: false,
      meta: { skeleton: <Skeleton className="size-6 rounded-full" />, expandedContent: (e: JournalEntry) => <Lines entry={e} /> },
    },
    {
      id: 'date',
      accessorFn: (e) => e.entry_date,
      header: ({ column }) => <DataGridColumnHeader title={t('ledger.date')} column={column} />,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {new Date(row.original.entry_date + 'T00:00:00').toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' })}
        </span>
      ),
      size: 100,
      meta: { skeleton: <Skeleton className="h-4 w-16" /> },
    },
    {
      id: 'accounts',
      accessorFn: (e) => accountsOf(e),
      header: ({ column }) => <DataGridColumnHeader title={t('gj.categoryAccount')} column={column} />,
      cell: ({ row: { original: e } }) => {
        const names = lineContacts(e.journal_lines, contactById)
        const note = e.description || null
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium">{accountsOf(e)}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {note ?? <span className="italic">{t('gj.noDescription')}</span>}
              {names.map((n) => <Badge key={n} variant="secondary" size="sm">{n}</Badge>)}
              {e.tags.map((x) => <Badge key={x.tag.name} variant="outline" size="sm">#{x.tag.name}</Badge>)}
            </span>
          </div>
        )
      },
      minSize: 300,
      meta: { skeleton: <Skeleton className="h-8 w-56" /> },
    },
    {
      id: 'amount',
      accessorFn: (e) => e.journal_lines.reduce((s, l) => s + (l.direction === 'debit' ? Number(l.base_amount) : 0), 0),
      header: ({ column }) => <DataGridColumnHeader title={t('gj.amount', { currency: base })} column={column} />,
      cell: ({ row }) => fmt(row.getValue<number>('amount')),
      size: 140,
      meta: {
        headerClassName: 'text-end [&>div]:justify-end', cellClassName: 'text-end tabular-nums',
        skeleton: <Skeleton className="ml-auto h-4 w-20" />,
      },
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row: { original: e } }) => {
        const canEdit = canModify(membership, access.data ?? [], e.member_id, 'edit')
        const canDelete = canModify(membership, access.data ?? [], e.member_id, 'delete')
        if (!canEdit && !canDelete) return null
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={t('gj.actions')} />}>
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && <DropdownMenuItem onClick={() => edit(e)}>{t('ledger.edit')}</DropdownMenuItem>}
              {canEdit && canDelete && <DropdownMenuSeparator />}
              {canDelete && <DropdownMenuItem variant="destructive" onClick={() => setDeleting(e)}>{t('ledger.delete')}</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      enableSorting: false,
      enableHiding: false,
      size: 48,
      meta: { skeleton: <Skeleton className="size-5" /> },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, base, i18n.language, exponents, byId, contactById, memberById, membership, access.data])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: visible,
    getRowId: (e: JournalEntry) => e.id,
    getRowCanExpand: () => true,
    state: { expanded, pagination: pages.pagination },
    onExpandedChange: setExpanded,
    onPaginationChange: pages.onPaginationChange,
    autoResetPageIndex: false,
  })

  const remove = useMutation({
    mutationFn: (e: JournalEntry) => callFunction('journal-post', { action: 'delete', entry_id: e.id }),
    onSuccess: () => { setDeleting(null); refresh() },
  })

  return (
    <>
      <PageHeader
        title={t('gj.title')} description={t('gj.subtitle')}
        actions={<Button disabled={!canCreate} onClick={() => setChoosing(true)}><PlusIcon data-icon="inline-start" />{t('gj.new')}</Button>}
      />

      {other && (
        <p className="text-sm text-muted-foreground">
          {t('members.viewing', { name: memberById.get(activeId)?.name ?? '' })} {canCreate ? t('members.canWrite') : t('members.viewOnly')}
        </p>
      )}
      <DataGrid
        table={table}
        recordCount={visible.length}
        isLoading={entries.isLoading}
        onRowClick={(e) => setExpanded((prev) => {
          const cur = prev === true ? {} : prev
          const { [e.id]: wasOpen, ...rest } = cur
          return wasOpen ? rest : { ...rest, [e.id]: true }
        })}
        tableLayout={{ dense: true, headerBackground: false }}
        emptyMessage={entries.isError ? (
          <Empty>
            <EmptyHeader><EmptyTitle>{t('gj.loadError')}</EmptyTitle></EmptyHeader>
            <Button variant="outline" size="sm" onClick={() => entries.refetch()}>{t('coa.retry')}</Button>
          </Empty>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t('gj.empty')}</EmptyTitle>
              <EmptyDescription>{t('gj.emptyHint')}</EmptyDescription>
            </EmptyHeader>
            <Button size="sm" disabled={!canCreate} onClick={() => setChoosing(true)}><PlusIcon data-icon="inline-start" />{t('gj.new')}</Button>
          </Empty>
        )}
        i18n={gridI18n}
      >
        <Frame spacing="sm" stacked>
          <FramePanel className="flex items-center gap-2 p-2">
            <ToggleGroup
              variant="outline" size="sm" spacing={0} value={[period]}
              onValueChange={(v) => v[0] && setPeriod(v[0] as Period)}
            >
              {(['month', 'lastMonth', 'year', 'custom'] as const).map((p) => (
                <ToggleGroupItem key={p} value={p}>{t(`gj.period.${p}`)}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            {period === 'custom' && (
              <>
                <Input type="date" className="w-36" aria-label={t('gj.from')} value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} />
                <Input type="date" className="w-36" aria-label={t('gj.to')} value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} />
              </>
            )}
            <div className="relative ml-auto">
              <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-72 ps-8" placeholder={t('gj.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </FramePanel>
          <FramePanel className="p-0">
            <DataGridContainer>
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
          </FramePanel>
          <FrameFooter className="flex-row items-center gap-4 py-1.5 pr-2 pl-2.5 text-xs text-muted-foreground">
            <DataGridPagination sizes={PAGE_SIZES} />
            <span className="text-nowrap">{t('gj.volume')}: <span className="tabular-nums text-foreground">{formatAmount(volume, baseExp, i18n.language)} {base}</span></span>
          </FrameFooter>
        </Frame>
      </DataGrid>

      <NewEntryChooser open={choosing} onClose={() => setChoosing(false)} onChoose={choose} />
      <QuickTransactionDialog kind={quick} onClose={() => setQuick(null)} membership={membership} />
      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null) }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{draft?.entryId ? t('gj.editing') : t('gj.chooser.free')}</DialogTitle>
          </DialogHeader>
          {draft && accounts.data && (
            <JournalEditor
              key={draft.entryId ?? 'new'} bare
              draft={draft} onChange={setDraft} accounts={postable} byId={byId} baseCurrency={base} groupId={membership.group.id} exponents={exponents}
              onCancel={() => setDraft(null)}
              onSaved={() => { setDraft(null); refresh() }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('gj.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <FormError message={remove.error ? errorMessage(t, remove.error) : null} />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('ledger.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive" disabled={remove.isPending}
              onClick={(ev) => { ev.preventDefault(); if (deleting) remove.mutate(deleting) }}
            >
              {t('ledger.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  // Detail of one entry: its lines. Account sits under the Account column, the amount under Amount;
  // a Debit/Credit label replaces the two money columns so the figures stay in one column.
  function Lines({ entry }: { entry: JournalEntry }) {
    return (
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col style={{ width: 324 }} /><col /><col style={{ width: 90 }} /><col style={{ width: 140 }} /><col style={{ width: 88 }} />
        </colgroup>
        <tbody className="bg-muted/30">
          {entry.journal_lines.map((l) => {
            const foreign = l.currency !== base
            return (
              <tr key={l.id} className="[&>td]:py-1.5">
                <td />
                <td className="truncate">
                  {byId.get(l.account_id)?.name}
                  {l.memo && <span className="ms-2 text-xs text-muted-foreground">{l.memo}</span>}
                  {foreign && (
                    <span className="ms-2 text-xs text-muted-foreground tabular-nums">
                      {fmt(Number(l.amount), l.currency)} {l.currency} × {Number(l.fx_rate).toLocaleString(i18n.language, { maximumFractionDigits: 6 })}
                    </span>
                  )}
                </td>
                <td><Badge variant={l.direction === 'debit' ? 'info-light' : 'secondary'} size="sm">{t(`ledger.${l.direction}`)}</Badge></td>
                <td className="text-end tabular-nums">{fmt(Number(l.base_amount))}</td>
                <td />
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }
}
