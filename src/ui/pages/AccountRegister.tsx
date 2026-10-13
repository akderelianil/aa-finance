import { useTable, type ColumnDef } from '@tanstack/react-table'
import { ArrowLeftIcon, MoreHorizontalIcon, PlusIcon, XIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { EntryHistory } from '@/components/journal/EntryHistory'
import { EntryDialog } from '@/components/journal/EntryDialog'
import { entryToDraft, newDraft, type Draft } from '@/components/journal/JournalEditor'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
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
import { call, useErrorText, useOp, useWrite } from '@/lib/api'
import { PAGE_SIZES, useGridI18n, useServerPages } from '@/lib/grid'
import type { Entry } from '@/lib/journal'
import { useFormat } from '@/lib/format'
import { shown, useAccountTree, useBook } from '@/lib/ledger'
import { cn } from '@/lib/utils'
import type { RegisterRow } from '../../core/api/accounts.ts'

const numberMeta = {
  headerClassName: 'text-end [&>div]:justify-end', cellClassName: 'text-end tabular-nums',
  skeleton: <Skeleton className="ml-auto h-4 w-20" />,
}

// Account Register (GnuCash register): one row per line on the account, oldest first, with the other account,
// debit, credit and the running balance in the account currency (natural side of the account type).
// Paged in SQL; it opens on the last page, where the newest lines are.
export default function AccountRegister() {
  const id = Number(useParams().id) || 0
  const { t, i18n } = useTranslation()
  const errorText = useErrorText()
  const { base, minor, fmt } = useBook()
  const { date: fmtDate } = useFormat()
  const accounts = useOp('accounts.list', {})
  const { byId } = useAccountTree(accounts.data)
  const account = byId.get(id)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [history, setHistory] = useState<Entry | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const filters = { id, from: from || undefined, to: to || undefined }
  const [total, setTotal] = useState<number>()
  const pages = useServerPages(JSON.stringify(filters), total, 'last')
  const register = useOp('accounts.register', { ...filters, page: pages.page ?? 0, pageSize: pages.pageSize }, { keep: true, enabled: !!id })
  if (register.data && register.data.total !== total) setTotal(register.data.total)
  const gridI18n = useGridI18n()

  const cur = account?.currency ?? base
  const side = (v: number) => (account ? shown(account.type, v) : v)
  const money = (v: number) => fmt(v, cur)

  // Edit and history need the whole entry: fetch it on demand.
  const open = async (entry: number, then: (e: Entry) => void) => then(await call('entries.get', { id: entry }))

  const columns = useMemo<ColumnDef<DataGridFeatures, RegisterRow>[]>(() => [
    {
      id: 'date',
      accessorFn: (r) => r.date,
      header: ({ column }) => <DataGridColumnHeader title={t('gj.date')} column={column} />,
      cell: ({ row: { original: r } }) => (
        <span className="tabular-nums">{fmtDate(r.date)}</span>
      ),
      size: 110,
      enableSorting: false,
      meta: { skeleton: <Skeleton className="h-4 w-20" /> },
    },
    {
      id: 'number',
      accessorFn: (r) => r.number,
      header: ({ column }) => <DataGridColumnHeader title={t('gj.number')} column={column} />,
      cell: ({ row: { original: r } }) => <span className="text-muted-foreground tabular-nums">{r.year}/{r.number}</span>,
      size: 80,
      enableSorting: false,
      meta: { skeleton: <Skeleton className="h-4 w-14" /> },
    },
    {
      id: 'description',
      accessorFn: (r) => r.description,
      header: ({ column }) => <DataGridColumnHeader title={t('gj.description')} column={column} />,
      cell: ({ row: { original: r } }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate">{r.description ?? <span className="text-muted-foreground italic">{t('gj.noDescription')}</span>}</span>
          {(r.memo || r.reference) && <span className="truncate text-xs text-muted-foreground">{[r.reference, r.memo].filter(Boolean).join(' · ')}</span>}
        </div>
      ),
      minSize: 160,
      enableSorting: false,
      meta: { skeleton: <Skeleton className="h-4 w-40" /> },
    },
    {
      id: 'other',
      accessorFn: (r) => r.other,
      header: ({ column }) => <DataGridColumnHeader title={t('reg.other')} column={column} />,
      cell: ({ row: { original: r } }) => (
        <span className={cn('truncate', !r.other && 'text-muted-foreground')}>
          {r.other ? byId.get(r.other)?.label : t('reg.split', { count: r.otherCount })}
        </span>
      ),
      size: 160,
      enableSorting: false,
      meta: { skeleton: <Skeleton className="h-4 w-28" /> },
    },
    {
      id: 'debit',
      accessorFn: (r) => r.amount,
      header: ({ column }) => <DataGridColumnHeader title={t('ledger.debit')} column={column} />,
      cell: ({ row: { original: r } }) => (r.amount > 0 ? money(r.amount) : ''),
      size: 120,
      enableSorting: false,
      meta: numberMeta,
    },
    {
      id: 'credit',
      accessorFn: (r) => r.amount,
      header: ({ column }) => <DataGridColumnHeader title={t('ledger.credit')} column={column} />,
      cell: ({ row: { original: r } }) => (r.amount < 0 ? money(-r.amount) : ''),
      size: 120,
      enableSorting: false,
      meta: numberMeta,
    },
    {
      id: 'balance',
      accessorFn: (r) => r.balance,
      header: ({ column }) => <DataGridColumnHeader title={t('reg.balance')} column={column} />,
      cell: ({ row: { original: r } }) => {
        const v = side(r.balance)
        return <span className={cn('font-medium', v < 0 && 'text-destructive')}>{money(v)}</span>
      },
      size: 130,
      enableSorting: false,
      meta: numberMeta,
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row: { original: r } }) => (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={t('common.actions')} />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => void open(r.entry, (e) => setDraft(entryToDraft(e, base, byId, minor)))}>{t('common.edit')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void open(r.entry, setHistory)}>{t('gj.history')}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => { remove.reset(); setDeleting(r.entry) }}>{t('common.delete')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 48,
      meta: { skeleton: <Skeleton className="size-5" /> },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, i18n.language, base, cur, byId, fmt, fmtDate, minor, account?.type])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: register.data?.rows ?? [],
    getRowId: (r: RegisterRow) => String(r.line),
    manualPagination: true,
    rowCount: register.data?.total ?? 0,
    state: { pagination: pages.pagination },
    onPaginationChange: pages.onPaginationChange,
    autoResetPageIndex: false,
  })

  const remove = useWrite('entries.delete', { inline: true })
  // A new entry starts with this account on the first line.
  const startEntry = () => {
    const d = newDraft()
    d.lines[0] = { ...d.lines[0], account: String(id) }
    setDraft(d)
  }

  if (accounts.isSuccess && !account) {
    return (
      <Empty>
        <EmptyHeader><EmptyTitle>{t('errors.account_not_found')}</EmptyTitle></EmptyHeader>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/hesaplar" />}>{t('reg.back')}</Button>
      </Empty>
    )
  }

  const now = account ? side(account.balance) : 0
  const opening = side(register.data?.opening ?? 0)

  return (
    <>
      <PageHeader
        title={account?.label ?? ''}
        description={account ? [account.path, t(`ledger.type.${account.type}`), account.currency].filter(Boolean).join(' · ') : ''}
        actions={(
          <>
            <Button variant="ghost" nativeButton={false} render={<Link to="/hesaplar" />}>
              <ArrowLeftIcon data-icon="inline-start" />{t('reg.back')}
            </Button>
            <Button onClick={startEntry} disabled={!account || account.placeholder || account.archived}>
              <PlusIcon data-icon="inline-start" />{t('gj.new')}
            </Button>
          </>
        )}
      />
      <DataGrid
        table={table}
        recordCount={register.data?.total ?? 0}
        isLoading={register.isPending}
        tableLayout={{ dense: true, headerBackground: false }}
        emptyMessage={register.isError ? (
          <Empty>
            <EmptyHeader><EmptyTitle>{t('state.error')}</EmptyTitle></EmptyHeader>
            <Button variant="outline" size="sm" onClick={() => register.refetch()}>{t('state.retry')}</Button>
          </Empty>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t('reg.empty')}</EmptyTitle>
              <EmptyDescription>{t('gj.emptyHint')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        i18n={gridI18n}
      >
        <Frame spacing="sm" stacked>
          <FramePanel className="flex items-center gap-2 p-2">
            <Input type="date" className="w-36" aria-label={t('gj.from')} value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-muted-foreground">–</span>
            <Input type="date" className="w-36" aria-label={t('gj.to')} value={to} onChange={(e) => setTo(e.target.value)} />
            {(from || to) && (
              <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo('') }}>
                <XIcon data-icon="inline-start" />{t('reg.clearRange')}
              </Button>
            )}
            <dl className="ml-auto flex items-center gap-6 pe-2 text-sm">
              <div className="flex items-baseline gap-2">
                <dt className="text-xs text-muted-foreground">{t('reg.opening')}</dt>
                <dd className={cn('tabular-nums', opening < 0 && 'text-destructive')}>{money(opening)}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-xs text-muted-foreground">{t('reg.current')}</dt>
                <dd className={cn('font-semibold tabular-nums', now < 0 && 'text-destructive')}>{money(now)} <span className="text-xs font-normal text-muted-foreground">{cur}</span></dd>
              </div>
            </dl>
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
            <AlertDialogTitle>{t('reg.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('gj.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          {remove.error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(remove.error)}</AlertDescription></Alert>}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive" disabled={remove.isPending}
              onClick={(ev) => { ev.preventDefault(); if (deleting) remove.mutate({ id: deleting }, { onSuccess: () => setDeleting(null) }) }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
