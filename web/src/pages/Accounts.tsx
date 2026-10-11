import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTable, type ColumnDef, type ExpandedState, type RowSelectionState } from '@tanstack/react-table'
import { ChevronsDownUpIcon, ChevronsUpDownIcon, LockIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { AccountDetail } from '@/components/coa/AccountDetail'
import { AccountDialog, type AccountTarget } from '@/components/coa/AccountDialog'
import { RootStrip } from '@/components/coa/RootStrip'
import { PageHeader } from '@/components/PageHeader'
import { FormError } from '@/components/PageShell'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/reui/badge'
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable, DataGridTableRowExpand } from '@/components/reui/data-grid/data-grid-table'
import { Frame, FrameFooter, FramePanel } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import {
  flattenTree, formatAmount, shown, useCurrencies, useLedgerAccounts, useMembers, type AccountNode, type AccountType,
} from '@/lib/ledger'
import { cn } from '@/lib/utils'

// Chart of Accounts (GnuCash "Accounts" tab): tree with own balance and subtree total.
export default function Accounts({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const base = membership.group.base_currency
  const accounts = useLedgerAccounts()
  const members = useMembers()
  const currencies = useCurrencies()
  const exp = new Map((currencies.data ?? []).map((c) => [c.code, c.exponent]))
  const fmt = (minor: number, cur: string) => formatAmount(minor || 0, exp.get(cur) ?? 2, i18n.language)

  const [expanded, setExpanded] = useState<ExpandedState>(true)
  const [selected, setSelected] = useState<RowSelectionState>({})
  const [rootFilter, setRootFilter] = useState<AccountType | null>(null)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [target, setTarget] = useState<AccountTarget | null>(null)
  const [deleting, setDeleting] = useState<AccountNode | null>(null)
  const [addingRecommended, setAddingRecommended] = useState(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ledger'] })
  // Recommended Gelir/Gider accounts are the unlocked template nodes; the admin can add them later.
  const hasRecommended = flattenTree(accounts.data?.roots ?? []).some((n) => n.template_key && !n.locked)
  const canAddRecommended = membership.role === 'admin' && !!accounts.data && !hasRecommended
  const memberName = new Map((members.data ?? []).map((m) => [m.id, m.name]))

  // Visible roots: archived nodes only on request; a search keeps matches and their ancestors.
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(i18n.language)
    const keep = (n: AccountNode): AccountNode | null => {
      if (n.archived_at && !showArchived) return null
      const children = n.children.map(keep).filter((c): c is AccountNode => !!c)
      const hit = !q || n.name.toLocaleLowerCase(i18n.language).includes(q)
      return hit || children.length ? { ...n, children } : null
    }
    return (accounts.data?.roots ?? [])
      .filter((r) => !rootFilter || r.type === rootFilter)
      .map(keep).filter((n): n is AccountNode => !!n)
  }, [accounts.data, search, showArchived, rootFilter, i18n.language])

  const selectedNode = useMemo(() => {
    const id = Object.keys(selected)[0]
    return id ? flattenTree(accounts.data?.roots ?? []).find((n) => n.id === id) ?? null : null
  }, [selected, accounts.data])
  const count = useMemo(() => flattenTree(visible).length, [visible])
  const baseFmt = (minor: number) => fmt(minor, base)

  const columns = useMemo<ColumnDef<DataGridFeatures, AccountNode>[]>(() => [
    {
      id: 'name',
      accessorFn: (n) => n.name,
      header: ({ column }) => <DataGridColumnHeader title={t('ledger.name')} column={column} />,
      cell: ({ row }) => {
        const n = row.original
        return (
          <div
            className={cn('flex items-center gap-1', n.archived_at && 'text-muted-foreground')}
            onDoubleClick={() => !n.is_placeholder && navigate(`/hesaplar/${n.id}`)}
          >
            <DataGridTableRowExpand row={row} className="-ms-1.5 -me-1" />
            <span className={cn(n.depth === 0 ? 'font-semibold' : 'font-medium', n.is_placeholder && n.depth > 0 && 'italic')}>{n.name}</span>
            {n.locked && <LockIcon className="size-3 text-muted-foreground" aria-label={t('coa.system')} />}
            {n.archived_at && <Badge variant="warning-light" size="sm">{t('coa.archived')}</Badge>}
          </div>
        )
      },
      minSize: 220,
      enableHiding: false,
      meta: { skeleton: <Skeleton className="h-4 w-40" /> },
    },
    {
      id: 'kind',
      accessorFn: (n) => n.subtype ?? n.type,
      header: ({ column }) => <DataGridColumnHeader title={t('coa.kind')} column={column} />,
      cell: ({ row: { original: n } }) => (
        <span className="text-muted-foreground">
          {n.depth === 0 || n.is_placeholder ? t('coa.placeholder') : n.subtype ? t(`ledger.subtype.${n.subtype}`) : t(`ledger.type.${n.type}`)}
        </span>
      ),
      size: 110,
      meta: { skeleton: <Skeleton className="h-4 w-20" /> },
    },
    {
      id: 'balance',
      accessorFn: (n) => shown(n.type, n.net),
      header: ({ column }) => <DataGridColumnHeader title={t('ledger.balance')} column={column} />,
      cell: ({ row: { original: n } }) => {
        const v = shown(n.type, n.net)
        if (n.is_placeholder) return null
        return (
          <span className={cn(v < 0 && 'text-destructive')}>
            {fmt(v, n.currency)} <span className="text-xs text-muted-foreground">{n.currency}</span>
          </span>
        )
      },
      size: 150,
      meta: {
        headerClassName: 'text-end [&>div]:justify-end', cellClassName: 'text-end tabular-nums',
        skeleton: <Skeleton className="ml-auto h-4 w-24" />,
      },
    },
    {
      id: 'total',
      accessorFn: (n) => shown(n.type, n.treeNetBase),
      header: ({ column }) => <DataGridColumnHeader title={t('ledger.total', { currency: base })} column={column} />,
      cell: ({ row: { original: n } }) => {
        const v = shown(n.type, n.treeNetBase)
        return <span className={cn(v < 0 && 'text-destructive')}>{fmt(v, base)}</span>
      },
      size: 150,
      meta: {
        headerClassName: 'text-end [&>div]:justify-end', cellClassName: 'text-end tabular-nums',
        skeleton: <Skeleton className="ml-auto h-4 w-24" />,
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, base, i18n.language, currencies.data, navigate])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: visible,
    getRowId: (n: AccountNode) => n.id,
    getSubRows: (n) => n.children,
    enableRowSelection: true,
    enableMultiRowSelection: false,
    paginateExpandedRows: false,
    state: { expanded: search ? true : expanded, rowSelection: selected, pagination: { pageIndex: 0, pageSize: 1000 } },
    onExpandedChange: setExpanded,
    onRowSelectionChange: setSelected,
  })

  const select = (n: AccountNode) => setSelected({ [n.id]: true })

  const archive = useMutation({
    mutationFn: (n: AccountNode) => callFunction('account-update', { account_id: n.id, archived: !n.archived_at }),
    onSuccess: refresh,
    onError: (e) => toast.add({ title: errorMessage(t, e), timeout: 4000 }),
  })
  const addRecommended = useMutation({
    mutationFn: () => callFunction('account-template-apply', {}),
    onSuccess: () => {
      toast.add({ title: t('coa.recommendedAdded'), timeout: 3000 })
      setAddingRecommended(false)
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (n: AccountNode) => callFunction<{ deleted?: boolean; archived?: boolean }>('account-delete', { account_id: n.id }),
    onSuccess: (r) => {
      toast.add({ title: r.archived ? t('coa.archivedNote') : t('coa.deleted'), timeout: 3000 })
      setDeleting(null)
      refresh()
    },
  })

  return (
    <>
      <PageHeader
        title={t('coa.title')} description={t('coa.subtitle')}
        actions={(
          <div className="flex items-center gap-2">
            {canAddRecommended && (
              <Button variant="outline" onClick={() => setAddingRecommended(true)}>{t('coa.addRecommended')}</Button>
            )}
            <Button onClick={() => setTarget({ mode: 'create', parent: null })}><PlusIcon data-icon="inline-start" />{t('coa.add')}</Button>
          </div>
        )}
      />
      <RootStrip roots={accounts.data?.roots ?? []} active={rootFilter} onSelect={setRootFilter} fmt={baseFmt} />
      <div className="grid grid-cols-[minmax(0,1fr)_22rem] items-start gap-4">
        <Frame spacing="sm" stacked>
          <FramePanel className="flex items-center gap-2 p-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-64 ps-8" placeholder={t('coa.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
              <ChevronsUpDownIcon data-icon="inline-start" />{t('coa.expandAll')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded({})}>
              <ChevronsDownUpIcon data-icon="inline-start" />{t('coa.collapseAll')}
            </Button>
            <label className="ml-auto flex items-center gap-2 pe-1 text-sm text-muted-foreground">
              <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
              {t('coa.showArchived')}
            </label>
          </FramePanel>
          <FramePanel className="p-0">
            <DataGrid
              table={table}
              recordCount={count}
              isLoading={accounts.isLoading}
              onRowClick={select}
              tableLayout={{ dense: true, headerBackground: false }}
              emptyMessage={accounts.isError ? (
                <Empty>
                  <EmptyHeader><EmptyTitle>{t('coa.loadError')}</EmptyTitle></EmptyHeader>
                  <Button variant="outline" size="sm" onClick={() => accounts.refetch()}>{t('coa.retry')}</Button>
                </Empty>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{t('coa.empty')}</EmptyTitle>
                    <EmptyDescription>{t('coa.search')}</EmptyDescription>
                  </EmptyHeader>
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
            <span>{t('coa.accountCount', { count })}</span>
            <span>{t('coa.amountsIn', { currency: base })}</span>
          </FrameFooter>
        </Frame>
        <AccountDetail
          node={selectedNode}
          base={base}
          ownerName={selectedNode?.owner_member_id ? memberName.get(selectedNode.owner_member_id) : undefined}
          fmt={fmt}
          onOpenRegister={(n) => navigate(`/hesaplar/${n.id}`)}
          onAddChild={(n) => setTarget({ mode: 'create', parent: n })}
          onEdit={(n) => setTarget({ mode: 'edit', node: n })}
          onArchive={(n) => archive.mutate(n)}
          onDelete={setDeleting}
        />
      </div>

      <AccountDialog
        target={target}
        roots={accounts.data?.roots ?? []}
        members={members.data ?? []}
        currencies={(currencies.data ?? []).map((c) => c.code)}
        baseCurrency={base}
        onClose={() => setTarget(null)}
        onSaved={refresh}
      />
      <AlertDialog open={addingRecommended} onOpenChange={(o) => !o && setAddingRecommended(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('coa.addRecommended')}</AlertDialogTitle>
            <AlertDialogDescription>{t('coa.addRecommendedDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <FormError message={addRecommended.error ? errorMessage(t, addRecommended.error) : null} />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); addRecommended.mutate() }} disabled={addRecommended.isPending}>
              {t('coa.addRecommendedConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('coa.deleteTitle', { name: deleting?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('coa.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <FormError message={remove.error ? errorMessage(t, remove.error) : null} />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('ledger.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive" disabled={remove.isPending}
              onClick={(e) => { e.preventDefault(); if (deleting) remove.mutate(deleting) }}
            >
              {t('ledger.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
