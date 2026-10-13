import { useTable, type ColumnDef, type ExpandedState, type RowSelectionState } from '@tanstack/react-table'
import { ChevronsDownUpIcon, ChevronsUpDownIcon, LockIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { AccountDetail } from '@/components/coa/AccountDetail'
import { AccountDialog, type AccountTarget } from '@/components/coa/AccountDialog'
import { accountActions, type AccountHandlers } from '@/components/coa/accountActions'
import { RootStrip } from '@/components/coa/RootStrip'
import { ScopeSelect } from '@/components/members/ScopeSelect'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable, DataGridTableRowExpand } from '@/components/reui/data-grid/data-grid-table'
import { Frame, FrameFooter, FramePanel } from '@/components/reui/frame'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { useErrorText, useOp, useWrite } from '@/lib/api'
import { flattenTree, shown, useAccountTree, useBook, type AccountNode, type AccountType } from '@/lib/ledger'
import { useScope, useScopedAccounts } from '@/lib/scope'
import { cn } from '@/lib/utils'

const numberMeta = {
  headerClassName: 'text-end [&>div]:justify-end', cellClassName: 'text-end tabular-nums',
  skeleton: <Skeleton className="ml-auto h-4 w-24" />,
}

// Chart of Accounts (GnuCash "Accounts" tab): tree with own balance and subtree total.
export default function Accounts() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const { base, fmt, currencies } = useBook()
  const { owner } = useScope()
  const accounts = useOp('accounts.list', { owner })
  const everyAccount = useOp('accounts.list', {})
  // The dialog picks parents among all accounts; the page shows the scope.
  const { roots: allRoots } = useAccountTree(everyAccount.data)
  const { roots } = useAccountTree(useScopedAccounts(accounts.data, owner))

  // null = default: every account open.
  const [expanded, setExpanded] = useState<ExpandedState | null>(null)
  const [ctxNode, setCtxNode] = useState<AccountNode | null>(null)
  const [selected, setSelected] = useState<RowSelectionState>({})
  const [rootFilter, setRootFilter] = useState<AccountType | null>(null)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [target, setTarget] = useState<AccountTarget | null>(null)
  const [deleting, setDeleting] = useState<AccountNode | null>(null)

  // Archived accounts only on request; a search keeps matches and their ancestors.
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(i18n.language)
    const keep = (n: AccountNode): AccountNode | null => {
      if (n.archived && !showArchived) return null
      const children = n.children.map(keep).filter((c): c is AccountNode => !!c)
      const hit = !q || n.label.toLocaleLowerCase(i18n.language).includes(q)
      return hit || children.length ? { ...n, children } : null
    }
    return roots.filter((r) => !rootFilter || r.type === rootFilter).map(keep).filter((n): n is AccountNode => !!n)
  }, [roots, search, showArchived, rootFilter, i18n.language])

  const flat = useMemo(() => flattenTree(visible), [visible])
  const selectedNode = flat.find((n) => selected[n.id]) ?? null
  const openIds = () => Object.fromEntries(flat.filter((n) => n.children.length).map((n) => [n.id, true]))
  const effectiveExpanded: ExpandedState = search ? true : expanded ?? true

  const columns = useMemo<ColumnDef<DataGridFeatures, AccountNode>[]>(() => [
    {
      id: 'name',
      accessorFn: (n) => n.label,
      header: ({ column }) => <DataGridColumnHeader title={t('coa.name')} column={column} />,
      cell: ({ row }) => {
        const n = row.original
        return (
          <div
            className={cn('flex items-center gap-1', n.archived && 'text-muted-foreground')}
            onDoubleClick={() => !n.placeholder && navigate(`/hesaplar/${n.id}`)}
          >
            <DataGridTableRowExpand row={row} className="-ms-1.5 -me-1" />
            <span className={cn(n.depth === 0 ? 'font-semibold' : 'font-medium', n.placeholder && n.depth > 0 && 'italic')}>{n.label}</span>
            {n.locked && <LockIcon className="size-3 text-muted-foreground" aria-label={t('coa.system')} />}
            {n.archived && <Badge variant="warning-light" size="sm">{t('coa.archived')}</Badge>}
          </div>
        )
      },
      minSize: 220,
      enableHiding: false,
      meta: { skeleton: <Skeleton className="h-4 w-40" /> },
    },
    {
      id: 'balance',
      accessorFn: (n) => shown(n.type, n.balance),
      header: ({ column }) => <DataGridColumnHeader title={t('coa.balance')} column={column} />,
      cell: ({ row: { original: n } }) => {
        if (n.placeholder) return null
        const v = shown(n.type, n.balance)
        return (
          <span className={cn(v < 0 && 'text-destructive')}>
            {fmt(v, n.currency)} <span className="text-xs text-muted-foreground">{n.currency}</span>
          </span>
        )
      },
      size: 160,
      meta: numberMeta,
    },
    {
      id: 'total',
      accessorFn: (n) => shown(n.type, n.treeBase),
      header: ({ column }) => <DataGridColumnHeader title={t('coa.total', { currency: base })} column={column} />,
      cell: ({ row: { original: n } }) => {
        const v = shown(n.type, n.treeBase)
        return <span className={cn(v < 0 && 'text-destructive')}>{fmt(v)}</span>
      },
      size: 160,
      meta: numberMeta,
    },
  ], [t, base, fmt, navigate])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: visible,
    getRowId: (n: AccountNode) => String(n.id),
    getSubRows: (n) => n.children,
    enableRowSelection: true,
    enableMultiRowSelection: false,
    paginateExpandedRows: false,
    autoResetExpanded: false,
    // While loading, the grid draws one skeleton row per pageSize row: keep it small. A tree does not page.
    state: { expanded: effectiveExpanded, rowSelection: selected, pagination: { pageIndex: 0, pageSize: accounts.isPending ? 10 : 10_000 } },
    onExpandedChange: (u) => setExpanded((prev) => {
      const cur = prev === null || prev === true ? openIds() : prev
      return typeof u === 'function' ? u(cur) : u
    }),
    onRowSelectionChange: setSelected,
  })

  const archive = useWrite('accounts.archive')
  const remove = useWrite('accounts.delete')
  const select = (n: AccountNode) => setSelected({ [n.id]: true })
  const handlers: AccountHandlers = {
    openRegister: (n) => navigate(`/hesaplar/${n.id}`),
    addChild: (n) => setTarget({ mode: 'create', parent: n }),
    edit: (n) => setTarget({ mode: 'edit', node: n }),
    archive: (n) => archive.mutate({ id: n.id, archived: !n.archived }, { onError: (e) => toast.add({ title: errorText(e), timeout: 4000 }) }),
    remove: (n) => { remove.reset(); setDeleting(n) },
  }
  const onContextMenu = (e: MouseEvent) => {
    const rowId = (e.target as HTMLElement).closest('[data-row-id]')?.getAttribute('data-row-id')
    const node = rowId ? flat.find((n) => String(n.id) === rowId) ?? null : null
    setCtxNode(node && accountActions(node, handlers, t).length ? node : null)
    if (node) select(node)
  }

  return (
    <>
      <PageHeader
        title={t('nav.accounts')} description={t('coa.subtitle')}
        actions={<><ScopeSelect /><Button onClick={() => setTarget({ mode: 'create', parent: null })}><PlusIcon data-icon="inline-start" />{t('coa.add')}</Button></>}
      />
      <RootStrip roots={roots} active={rootFilter} onSelect={setRootFilter} fmt={(v) => fmt(v)} />
      <div className="grid grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem] items-start gap-4">
        <Frame spacing="sm" stacked>
          <FramePanel className="flex items-center gap-2 p-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-56 ps-8" placeholder={t('coa.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(openIds())}>
              <ChevronsUpDownIcon data-icon="inline-start" />{t('coa.expandAll')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded({})}>
              <ChevronsDownUpIcon data-icon="inline-start" />{t('coa.collapseAll')}
            </Button>
            <label className="ml-auto flex shrink-0 items-center gap-2 pe-1 text-sm whitespace-nowrap text-muted-foreground">
              <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
              {t('coa.showArchived')}
            </label>
          </FramePanel>
          <FramePanel className="p-0">
            <ContextMenu>
              <ContextMenuTrigger render={<div onContextMenu={onContextMenu} />}>
                <DataGrid
                  table={table}
                  recordCount={flat.length}
                  isLoading={accounts.isPending}
                  onRowClick={select}
                  tableLayout={{ dense: true, headerBackground: false }}
                  emptyMessage={(
                    <Empty>
                      <EmptyHeader><EmptyTitle>{accounts.isError ? t('state.error') : t('coa.empty')}</EmptyTitle></EmptyHeader>
                      {accounts.isError && <Button variant="outline" size="sm" onClick={() => accounts.refetch()}>{t('state.retry')}</Button>}
                    </Empty>
                  )}
                >
                  <DataGridContainer>
                    <DataGridScrollArea>
                      <DataGridTable />
                    </DataGridScrollArea>
                  </DataGridContainer>
                </DataGrid>
              </ContextMenuTrigger>
              {ctxNode && (
                <ContextMenuContent>
                  {accountActions(ctxNode, handlers, t).map((a) => (
                    <div key={a.key}>
                      {a.key === 'archive' && <ContextMenuSeparator />}
                      <ContextMenuItem variant={a.destructive ? 'destructive' : undefined} onClick={a.onSelect}>{a.label}</ContextMenuItem>
                    </div>
                  ))}
                </ContextMenuContent>
              )}
            </ContextMenu>
          </FramePanel>
          <FrameFooter className="flex-row items-center justify-between text-xs text-muted-foreground">
            <span>{t('coa.accountCount', { count: flat.length })}</span>
            <span>{t('coa.amountsIn', { currency: base })}</span>
          </FrameFooter>
        </Frame>
        <div className="sticky top-4">
          <AccountDetail
            node={selectedNode} base={base} fmt={fmt}
            actions={selectedNode ? accountActions(selectedNode, handlers, t) : []}
          />
        </div>
      </div>

      <AccountDialog target={target} roots={allRoots} currencies={currencies.map((c) => c.code)} onClose={() => setTarget(null)} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('coa.deleteTitle', { name: deleting?.label ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('coa.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          {remove.error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(remove.error)}</AlertDescription></Alert>}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive" disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (deleting) remove.mutate({ id: deleting.id }, { onSuccess: () => { setDeleting(null); setSelected({}) } })
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
