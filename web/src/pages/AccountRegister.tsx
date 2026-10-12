import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTable, type ColumnDef } from '@tanstack/react-table'
import { ArrowLeftIcon, MoreHorizontalIcon, PlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { JournalEditor } from '@/components/journal/JournalEditor'
import { DataState } from '@/components/DataState'
import { PageHeader } from '@/components/PageHeader'
import { FormError } from '@/components/PageShell'
import { Badge } from '@/components/reui/badge'
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
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
import { callFunction } from '@/lib/api'
import { lineContacts, useContacts } from '@/lib/contacts'
import { errorMessage } from '@/lib/errors'
import { emptyLine, entryToDraft, today, useAccountEntries, type Draft, type JournalEntry } from '@/lib/journal'
import {
  flattenTree, formatAmount, fullName, shown, useCurrencies, useLedgerAccounts, type AccountNode,
} from '@/lib/ledger'
import { canModify, useMemberAccess } from '@/lib/access'
import { cn } from '@/lib/utils'

type Row = {
  id: string; entry?: JournalEntry; opening?: boolean
  debit: number; credit: number; memo: string | null; other: string; balance: number
}

// Account Register (GnuCash register): one row per line on the account with the other account, debit, credit
// and the running balance in the account currency (normal sign of the account type).
export default function AccountRegister({ membership }: { membership: Membership }) {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const base = membership.group.base_currency
  const accounts = useLedgerAccounts()
  const access = useMemberAccess()
  const currencies = useCurrencies()
  const entries = useAccountEntries(id)
  const contacts = useContacts()
  const contactById = useMemo(() => new Map((contacts.data ?? []).map((c) => [c.id, c])), [contacts.data])
  const exponents = new Map((currencies.data ?? []).map((c) => [c.code, c.exponent]))
  const byId = useMemo(() => accounts.data?.byId ?? new Map<string, AccountNode>(), [accounts.data])
  const account = id ? byId.get(id) : undefined
  const postable = useMemo(
    () => flattenTree(accounts.data?.roots ?? []).filter((a) => !a.is_placeholder && !a.archived_at),
    [accounts.data],
  )
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<JournalEntry | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ledger'] })
  const exp = account ? exponents.get(account.currency) ?? 2 : 2
  const fmt = (minor: number) => formatAmount(minor, exp, i18n.language)

  // Rows with the running balance over all lines; the date range only hides rows (opening = balance before).
  const rows = useMemo(() => {
    if (!account) return []
    let balance = 0
    let opening = 0
    const rows: Row[] = []
    for (const e of entries.data ?? []) {
      for (const l of e.journal_lines.filter((x) => x.account_id === account.id)) {
        const amount = Number(l.amount)
        balance += shown(account.type, l.direction === 'debit' ? amount : -amount)
        if (from && e.entry_date < from) { opening = balance; continue }
        if (to && e.entry_date > to) continue
        const others = e.journal_lines.filter((x) => x.account_id !== account.id)
        const o = others.length === 1 ? byId.get(others[0].account_id) : undefined
        rows.push({
          entry: e, id: l.id, memo: l.memo, balance,
          debit: l.direction === 'debit' ? amount : 0, credit: l.direction === 'credit' ? amount : 0,
          other: o ? o.name : others.length ? t('reg.split') : '',
        })
      }
    }
    if (from) rows.unshift({ id: 'opening', opening: true, debit: 0, credit: 0, memo: null, other: '', balance: opening })
    return rows
  }, [account, entries.data, from, to, byId, t])

  const remove = useMutation({
    mutationFn: (e: JournalEntry) => callFunction('journal-post', { action: 'delete', entry_id: e.id }),
    onSuccess: () => { setDeleting(null); refresh() },
  })

  const newEntry = () => setDraft({
    date: today(), description: '', tags: [], lines: [{ ...emptyLine(), accountId: account!.id }, emptyLine()],
  })

  const canPost = !!account && !account.is_placeholder && !account.archived_at
  const num = { headerClassName: 'text-end [&>div]:justify-end', cellClassName: 'text-end tabular-nums' }
  const columns = useMemo<ColumnDef<DataGridFeatures, Row>[]>(() => [
    {
      id: 'date', header: t('ledger.date'), size: 100, enableSorting: false,
      cell: ({ row: { original: r } }) => (r.opening
        ? <span className="text-muted-foreground">{t('reg.opening')}</span>
        : <span className="tabular-nums">{new Date(r.entry!.entry_date + 'T00:00:00').toLocaleDateString(i18n.language)}</span>),
      meta: { skeleton: <Skeleton className="h-4 w-16" /> },
    },
    {
      id: 'description', header: t('ledger.description'), minSize: 240, enableSorting: false,
      cell: ({ row: { original: r } }) => r.opening ? null : (
        <span className="flex items-center gap-2">
          <span className="truncate">{r.entry!.description}</span>
          {lineContacts(r.entry!.journal_lines, contactById).map((n) => <Badge key={n} variant="secondary" size="sm">{n}</Badge>)}
          {r.entry!.tags.map((x) => <Badge key={x.tag.name} variant="outline" size="sm">#{x.tag.name}</Badge>)}
        </span>
      ),
      meta: { skeleton: <Skeleton className="h-4 w-48" /> },
    },
    {
      id: 'other', header: t('reg.other'), size: 180, enableSorting: false,
      cell: ({ row: { original: r } }) => <span className={cn('truncate', r.other === t('reg.split') && 'italic text-muted-foreground')}>{r.other}</span>,
      meta: { skeleton: <Skeleton className="h-4 w-28" /> },
    },
    {
      id: 'memo', header: t('ledger.memo'), size: 160, enableSorting: false,
      cell: ({ row: { original: r } }) => <span className="truncate text-muted-foreground">{r.memo}</span>,
      meta: { skeleton: <Skeleton className="h-4 w-24" /> },
    },
    {
      id: 'debit', header: t('ledger.debit'), size: 130, enableSorting: false,
      cell: ({ row: { original: r } }) => (r.debit ? fmt(r.debit) : ''),
      meta: { ...num, skeleton: <Skeleton className="ml-auto h-4 w-16" /> },
    },
    {
      id: 'credit', header: t('ledger.credit'), size: 130, enableSorting: false,
      cell: ({ row: { original: r } }) => (r.credit ? fmt(r.credit) : ''),
      meta: { ...num, skeleton: <Skeleton className="ml-auto h-4 w-16" /> },
    },
    {
      id: 'balance', header: t('ledger.balance'), size: 150, enableSorting: false,
      cell: ({ row: { original: r } }) => <span className={cn(r.balance < 0 && 'text-destructive')}>{fmt(r.balance)}</span>,
      meta: { ...num, skeleton: <Skeleton className="ml-auto h-4 w-20" /> },
    },
    {
      id: 'actions', header: () => null, size: 48, enableSorting: false, enableHiding: false,
      cell: ({ row: { original: r } }) => {
        if (!r.entry) return null
        const canEdit = canModify(membership, access.data ?? [], r.entry.member_id, 'edit')
        const canDelete = canModify(membership, access.data ?? [], r.entry.member_id, 'delete')
        if (!canEdit && !canDelete) return null
        const e = r.entry
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={t('gj.actions')} />}>
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && <DropdownMenuItem onClick={() => setDraft(entryToDraft(e, base, exponents))}>{t('ledger.edit')}</DropdownMenuItem>}
              {canEdit && canDelete && <DropdownMenuSeparator />}
              {canDelete && <DropdownMenuItem variant="destructive" onClick={() => setDeleting(e)}>{t('ledger.delete')}</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      meta: { skeleton: <Skeleton className="size-5" /> },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, i18n.language, exp, contactById, membership, access.data, base, currencies.data, account])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    getRowId: (r: Row) => r.id,
    // While loading, the grid draws one skeleton row per pageSize row: keep it small.
    state: { pagination: { pageIndex: 0, pageSize: entries.isLoading ? 10 : 5000 } },
  })

  if (accounts.isLoading) return <DataState loading />
  if (!account) return <DataState empty={{ title: t('reg.notFound') }} />
  const total = shown(account.type, account.net)

  return (
    <>
      <Button variant="ghost" size="sm" className="self-start" nativeButton={false} render={<Link to="/hesaplar" />}>
        <ArrowLeftIcon data-icon="inline-start" />{t('coa.title')}
      </Button>
      <PageHeader
        title={account.name}
        description={`${fullName(account, byId)} · ${t(`ledger.type.${account.type}`)} · ${account.currency}`}
        actions={(
          <>
            <div className="mr-4 text-right">
              <div className="text-xs text-muted-foreground">{t('ledger.balance')}</div>
              <div className={cn('font-mono text-xl font-semibold tabular-nums', total < 0 && 'text-destructive')}>
                {fmt(total)} <span className="text-sm text-muted-foreground">{account.currency}</span>
              </div>
            </div>
            {!draft && canPost && (
              <Button onClick={newEntry}><PlusIcon data-icon="inline-start" />{t('gj.new')}</Button>
            )}
          </>
        )}
      />
      {draft && (
        <JournalEditor
          key={draft.entryId ?? 'new'}
          draft={draft} onChange={setDraft} accounts={postable} byId={byId} baseCurrency={base} groupId={membership.group.id} exponents={exponents}
          onCancel={() => setDraft(null)}
          onSaved={() => { setDraft(null); refresh() }}
        />
      )}

      <Frame spacing="sm" stacked>
        <FramePanel className="flex items-center gap-2 p-2">
          <Input type="date" className="w-36" aria-label={t('gj.from')} value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="w-36" aria-label={t('gj.to')} value={to} onChange={(e) => setTo(e.target.value)} />
          {(from || to) && (
            <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo('') }}>{t('reg.clearRange')}</Button>
          )}
        </FramePanel>
        <FramePanel className="p-0">
          <DataGrid
            table={table}
            recordCount={rows.length}
            isLoading={entries.isLoading}
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
                {canPost && !draft && <Button size="sm" onClick={newEntry}><PlusIcon data-icon="inline-start" />{t('gj.new')}</Button>}
              </Empty>
            )}
          >
            <DataGridContainer>
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
          </DataGrid>
        </FramePanel>
        <FrameFooter className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('gj.count', { count: rows.filter((r) => !r.opening).length })}</span>
          <span>{t('ledger.balance')}: <span className="tabular-nums text-foreground">{fmt(total)} {account.currency}</span></span>
        </FrameFooter>
      </Frame>

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
}
