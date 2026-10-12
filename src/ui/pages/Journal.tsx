import { useTable, type ColumnDef, type ExpandedState } from '@tanstack/react-table'
import { MoreHorizontalIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EntryHistory } from '@/components/journal/EntryHistory'
import { EntryDialog } from '@/components/journal/EntryDialog'
import { entryToDraft, newDraft, type Draft } from '@/components/journal/JournalEditor'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/reui/alert'
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { today } from '@/lib/amount'
import { useErrorText, useOp, useWrite } from '@/lib/api'
import { PAGE_SIZES, useGridI18n, useServerPages } from '@/lib/grid'
import type { Entry } from '@/lib/journal'
import { MemberAvatar } from '@/components/members/MemberAvatar'
import { useFormat } from '@/lib/format'
import { useAccountTree, useBook } from '@/lib/ledger'

type Period = 'month' | 'lastMonth' | 'year' | 'all' | 'custom'

const iso = (d: Date) => d.toLocaleDateString('sv')
function periodRange(p: Exclude<Period, 'custom'>): [string | undefined, string | undefined] {
  const n = new Date()
  if (p === 'month') return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), undefined]
  if (p === 'lastMonth') return [iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), iso(new Date(n.getFullYear(), n.getMonth(), 0))]
  if (p === 'year') return [iso(new Date(n.getFullYear(), 0, 1)), undefined]
  return [undefined, undefined]
}

const numberMeta = {
  headerClassName: 'text-end [&>div]:justify-end', cellClassName: 'text-end tabular-nums',
  skeleton: <Skeleton className="ml-auto h-4 w-20" />,
}

// General Journal (GnuCash "General Journal"): one row per entry, newest first, paged in SQL.
// The debit/credit lines open on demand; edit, history and delete live in the row menu.
export default function Journal() {
  const { t, i18n } = useTranslation()
  const errorText = useErrorText()
  const { base, minor, fmt } = useBook()
  const { date: fmtDate } = useFormat()
  const [period, setPeriod] = useState<Period>('all')
  const [custom, setCustom] = useState<[string, string]>([iso(new Date(new Date().getFullYear(), 0, 1)), today()])
  const [from, to] = period === 'custom' ? custom : periodRange(period)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [draft, setDraft] = useState<Draft | null>(null)
  const [history, setHistory] = useState<Entry | null>(null)
  const [deleting, setDeleting] = useState<Entry | null>(null)

  const me = useOp('settings.get', {}).data?.me
  const accounts = useOp('accounts.list', {})
  const { byId } = useAccountTree(accounts.data)
  const filters = { from: from || undefined, to: to || undefined, search: search.trim() || undefined }
  const [total, setTotal] = useState<number>()
  const pages = useServerPages(JSON.stringify(filters), total)
  const entries = useOp('entries.list', { ...filters, page: pages.page ?? 0, pageSize: pages.pageSize }, { keep: true })
  if (entries.data && entries.data.total !== total) setTotal(entries.data.total)
  const gridI18n = useGridI18n()

  const accountsOf = (e: Entry) => {
    const names = (debit: boolean) => [...new Set(e.lines.filter((l) => (l.amount > 0) === debit).map((l) => byId.get(l.account)?.label ?? ''))]
    const [d, c] = [names(true), names(false)]
    return d.length === 1 && c.length === 1 ? `${d[0]} → ${c[0]}` : t('gj.lines', { count: e.lines.length })
  }
  const volume = (e: Entry) => e.lines.reduce((s, l) => s + (l.baseAmount > 0 ? l.baseAmount : 0), 0)
  /** A member changes own entries; an admin all. */
  const canChange = (e: Entry) => me?.role === 'admin' || e.author.id === me?.id
  const edit = (e: Entry) => setDraft(entryToDraft(e, base, byId, minor))

  const columns = useMemo<ColumnDef<DataGridFeatures, Entry>[]>(() => [
    {
      id: 'number',
      accessorFn: (e) => e.number,
      header: ({ column }) => <DataGridColumnHeader title={t('gj.number')} column={column} />,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <DataGridTableRowExpand row={row} className="-ms-1.5 -me-1" />
          <span className="text-muted-foreground tabular-nums">{row.original.year}/{row.original.number}</span>
        </div>
      ),
      size: 110,
      enableSorting: false,
      enableHiding: false,
      meta: { skeleton: <Skeleton className="h-4 w-16" />, expandedContent: (e: Entry) => <Lines entry={e} /> },
    },
    {
      id: 'date',
      accessorFn: (e) => e.date,
      header: ({ column }) => <DataGridColumnHeader title={t('gj.date')} column={column} />,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {fmtDate(row.original.date)}
        </span>
      ),
      size: 120,
      enableSorting: false,
      meta: { skeleton: <Skeleton className="h-4 w-20" /> },
    },
    {
      id: 'accounts',
      accessorFn: (e) => accountsOf(e),
      header: ({ column }) => <DataGridColumnHeader title={t('gj.entry')} column={column} />,
      cell: ({ row: { original: e } }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{accountsOf(e)}</span>
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{e.description ?? <span className="italic">{t('gj.noDescription')}</span>}</span>
            {e.reference && <Badge variant="outline" size="sm">{e.reference}</Badge>}
          </span>
        </div>
      ),
      minSize: 300,
      enableSorting: false,
      meta: { skeleton: <Skeleton className="h-8 w-56" /> },
    },
    {
      id: 'author',
      accessorFn: (e) => e.author.name,
      header: ({ column }) => <DataGridColumnHeader title={t('gj.author')} column={column} />,
      cell: ({ row: { original: e } }) => (
        <span className="flex min-w-0 items-center gap-2">
          <MemberAvatar name={e.author.name} color={e.author.color} />
          <span className="truncate">{e.author.name}</span>
        </span>
      ),
      size: 150,
      enableSorting: false,
      meta: { skeleton: <Skeleton className="h-4 w-24" /> },
    },
    {
      id: 'amount',
      accessorFn: volume,
      header: ({ column }) => <DataGridColumnHeader title={t('gj.amount', { currency: base })} column={column} />,
      cell: ({ row }) => fmt(volume(row.original)),
      size: 150,
      enableSorting: false,
      meta: numberMeta,
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row: { original: e } }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={t('common.actions')} />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canChange(e) && <DropdownMenuItem onClick={() => edit(e)}>{t('common.edit')}</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => setHistory(e)}>{t('gj.history')}</DropdownMenuItem>
            {canChange(e) && <DropdownMenuSeparator />}
            {canChange(e) && <DropdownMenuItem variant="destructive" onClick={() => { remove.reset(); setDeleting(e) }}>{t('common.delete')}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 48,
      meta: { skeleton: <Skeleton className="size-5" /> },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, i18n.language, base, byId, fmt, fmtDate, me])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: entries.data?.rows ?? [],
    getRowId: (e: Entry) => String(e.id),
    getRowCanExpand: () => true,
    manualPagination: true,
    rowCount: entries.data?.total ?? 0,
    state: { expanded, pagination: pages.pagination },
    onExpandedChange: setExpanded,
    onPaginationChange: pages.onPaginationChange,
    autoResetPageIndex: false,
    autoResetExpanded: false,
  })

  const remove = useWrite('entries.delete')
  const newEntry = <Button onClick={() => setDraft(newDraft())}><PlusIcon data-icon="inline-start" />{t('gj.new')}</Button>

  return (
    <>
      <PageHeader title={t('nav.journal')} description={t('gj.subtitle')} actions={newEntry} />
      <DataGrid
        table={table}
        recordCount={entries.data?.total ?? 0}
        isLoading={entries.isPending}
        onRowClick={(e) => setExpanded((prev) => {
          const cur = prev === true ? {} : prev
          const { [e.id]: wasOpen, ...rest } = cur
          return wasOpen ? rest : { ...rest, [e.id]: true }
        })}
        tableLayout={{ dense: true, headerBackground: false }}
        emptyMessage={entries.isError ? (
          <Empty>
            <EmptyHeader><EmptyTitle>{t('state.error')}</EmptyTitle></EmptyHeader>
            <Button variant="outline" size="sm" onClick={() => entries.refetch()}>{t('state.retry')}</Button>
          </Empty>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t('gj.empty')}</EmptyTitle>
              <EmptyDescription>{t('gj.emptyHint')}</EmptyDescription>
            </EmptyHeader>
            {newEntry}
          </Empty>
        )}
        i18n={gridI18n}
      >
        <Frame spacing="sm" stacked>
          <FramePanel className="flex items-center gap-2 p-2">
            <ToggleGroup variant="outline" size="sm" spacing={0} value={[period]} onValueChange={(v) => v[0] && setPeriod(v[0] as Period)}>
              {(['all', 'month', 'lastMonth', 'year', 'custom'] as const).map((p) => (
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
              <Input className="w-64 ps-8" placeholder={t('gj.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
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
          </FrameFooter>
        </Frame>
      </DataGrid>

      <EntryDialog draft={draft} onChange={setDraft} onClose={() => setDraft(null)} />

      <EntryHistory entry={history} onClose={() => setHistory(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('gj.deleteTitle', { no: deleting ? `${deleting.year}/${deleting.number}` : '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('gj.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          {remove.error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(remove.error)}</AlertDescription></Alert>}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive" disabled={remove.isPending}
              onClick={(ev) => { ev.preventDefault(); if (deleting) remove.mutate({ id: deleting.id }, { onSuccess: () => setDeleting(null) }) }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  // One entry's lines: account and memo, Borç/Alacak label, the amount in base currency; a foreign line shows its own amount and rate.
  function Lines({ entry }: { entry: Entry }) {
    return (
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col style={{ width: 230 }} /><col /><col style={{ width: 90 }} /><col style={{ width: 150 }} /><col style={{ width: 71 }} />
        </colgroup>
        <tbody className="bg-muted/30">
          {entry.lines.map((l) => {
            const acc = byId.get(l.account)
            const foreign = acc && acc.currency !== base
            return (
              <tr key={l.id} className="[&>td]:py-1.5">
                <td />
                <td className="truncate">
                  {acc?.label}
                  {l.memo && <span className="ms-2 text-xs text-muted-foreground">{l.memo}</span>}
                  {foreign && (
                    <span className="ms-2 text-xs text-muted-foreground tabular-nums">
                      {fmt(Math.abs(l.amount), acc.currency)} {acc.currency}{l.rate && ` × ${l.rate}`}
                    </span>
                  )}
                </td>
                <td><Badge variant={l.amount > 0 ? 'info-light' : 'secondary'} size="sm">{t(l.amount > 0 ? 'ledger.debit' : 'ledger.credit')}</Badge></td>
                <td className="text-end tabular-nums">{fmt(Math.abs(l.baseAmount))}</td>
                <td />
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }
}
