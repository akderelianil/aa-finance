import { useTable, type ColumnDef } from '@tanstack/react-table'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DataState } from '@/components/DataState'
import { OptionSelect } from '@/components/OptionSelect'
import { ScopeSelect } from '@/components/members/ScopeSelect'
import { PageHeader } from '@/components/PageHeader'
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { Frame, FrameFooter, FramePanel } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { today } from '@/lib/amount'
import { useOp } from '@/lib/api'
import { shown, useAccountTree, useBook, type AccountNode, type AccountType } from '@/lib/ledger'
import { useScope } from '@/lib/scope'
import { cn } from '@/lib/utils'

type Tab = 'trial' | 'balance' | 'income'
type Row = { id: string | number; label: string; depth: number; kind: 'head' | 'strong' | 'group' | 'row' | 'total'; v: number[] }
/** One account with its subtree: the values summed over the subtree (signed like lines). */
type Node = { node: AccountNode; v: number[]; children: Node[] }

function rollUp(nodes: AccountNode[], own: Map<number, number[]>, width: number): Node[] {
  return nodes.map((node) => {
    const children = rollUp(node.children, own, width)
    const v = [...(own.get(node.id) ?? Array(width).fill(0))]
    for (const c of children) c.v.forEach((x, i) => (v[i] += x))
    return { node, v, children }
  })
}

// Reports in the base currency: Trial Balance (Mizan, cumulative to the date), Balance Sheet (Bilanço, at the date)
// and Income Statement (Gelir Tablosu, for the period). Trees roll up children; no paging.
export default function Reports() {
  const { t } = useTranslation()
  const { base, fmt } = useBook()
  const [tab, setTab] = useState<Tab>('trial')
  const [from, setFrom] = useState(`${today().slice(0, 4)}-01-01`)
  const [to, setTo] = useState(today())
  const [depth, setDepth] = useState('9')
  const [showZero, setShowZero] = useState(false)

  const { owner } = useScope()
  const accounts = useOp('accounts.list', {})
  const { roots } = useAccountTree(accounts.data)
  const trial = useOp('reports.trialBalance', { asOf: to, owner }, { enabled: tab === 'trial' })
  const sheet = useOp('reports.balanceSheet', { asOf: to, owner }, { enabled: tab === 'balance' })
  const income = useOp('reports.incomeStatement', { from, to, owner }, { enabled: tab === 'income' && !!from && !!to })
  const report = { trial, balance: sheet, income }[tab]
  const loading = accounts.isPending || report.isPending
  const failed = accounts.isError || report.isError
  const maxDepth = Number(depth)

  // Flat rows of a tree down to the chosen depth; all-zero rows hidden unless asked.
  function treeRows(nodes: Node[], value: (n: Node) => number[], out: Row[] = []): Row[] {
    for (const n of nodes) {
      if ((!showZero && n.v.every((x) => x === 0)) || n.node.depth >= maxDepth) continue
      out.push({ id: n.node.id, label: n.node.label, depth: n.node.depth, kind: n.node.depth === 0 ? 'strong' : n.children.length ? 'group' : 'row', v: value(n) })
      treeRows(n.children, value, out)
    }
    return out
  }
  const ofType = (tree: Node[], ...types: AccountType[]) => tree.filter((n) => types.includes(n.node.type))
  const natural = (n: Node) => [shown(n.node.type, n.v[0])]
  const total = (nodes: Node[]) => nodes.reduce((s, n) => s + natural(n)[0], 0)
  const netLabel = (n: number) => t(n >= 0 ? 'rep.netProfit' : 'rep.netLoss')
  function section(title: string, nodes: Node[], extra: Row[] = [], sum = total(nodes)): Row[] {
    return [
      { id: `h-${title}`, label: title, depth: 0, kind: 'head', v: [] },
      ...treeRows(nodes.flatMap((n) => n.children), natural),
      ...extra,
      { id: `t-${title}`, label: t('rep.total', { name: title }), depth: 0, kind: 'total', v: [sum] },
    ]
  }

  let heads: string[] = [t('rep.amount')]
  let rows: Row[] = []
  // A scope shows only some accounts, so the two sides need not match: no balance check, a note instead.
  let foot: ReactNode = owner === undefined ? null : <span>{t('rep.scoped')}</span>
  if (!loading && !failed) {
    if (tab === 'trial' && trial.data) {
      heads = [t('rep.debitTotal'), t('rep.creditTotal'), t('rep.debitBalance'), t('rep.creditBalance')]
      const tree = rollUp(roots, new Map(trial.data.rows.map((r) => [r.account, [r.debit, r.credit]])), 2)
      const d = trial.data.rows.reduce((s, r) => s + r.debit, 0)
      const c = trial.data.rows.reduce((s, r) => s + r.credit, 0)
      rows = [
        ...treeRows(tree, (n) => [n.v[0], n.v[1], Math.max(n.v[0] - n.v[1], 0), Math.max(n.v[1] - n.v[0], 0)]),
        { id: 'grand', label: t('rep.grandTotal'), depth: 0, kind: 'total', v: [d, c, trial.data.debit, trial.data.credit] },
      ]
    }
    if (tab === 'balance' && sheet.data) {
      const tree = rollUp(roots, new Map(sheet.data.rows.map((r) => [r.account, [r.balance]])), 1)
      // Unclosed income and expense: minus is profit, shown on the equity side.
      const net = -sheet.data.earnings
      const assets = total(ofType(tree, 'asset'))
      const liabilities = total(ofType(tree, 'liability'))
      const equity = total(ofType(tree, 'equity')) + net
      rows = [
        ...section(t('rep.assets'), ofType(tree, 'asset')),
        ...section(t('rep.liabilities'), ofType(tree, 'liability')),
        ...section(t('rep.equity'), ofType(tree, 'equity'), [{ id: 'net', label: netLabel(net), depth: 1, kind: 'row', v: [net] }], equity),
        { id: 'sources', label: t('rep.totalSources'), depth: 0, kind: 'total', v: [liabilities + equity] },
      ]
      if (owner === undefined) foot = assets === liabilities + equity
        ? <span>{t('rep.balanced')}</span>
        : <span className="font-medium text-destructive">{t('rep.unbalanced', { amount: fmt(assets - liabilities - equity) })}</span>
    }
    if (tab === 'income' && income.data) {
      const tree = rollUp(roots, new Map(income.data.rows.map((r) => [r.account, [r.balance]])), 1)
      const net = -income.data.net
      rows = [
        ...section(t('rep.income'), ofType(tree, 'income')),
        ...section(t('rep.expense'), ofType(tree, 'expense')),
        { id: 'net', label: netLabel(net), depth: 0, kind: 'total', v: [net] },
      ]
    }
  }

  const columns = useMemo<ColumnDef<DataGridFeatures, Row>[]>(() => [
    {
      id: 'name', header: t('gj.account'), minSize: 260, enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <span
          style={{ paddingLeft: `${r.depth * 1.25}rem` }}
          className={cn('truncate', r.kind !== 'row' && 'font-medium', (r.kind === 'head' || r.kind === 'total') && 'font-semibold')}
        >
          {r.label}
        </span>
      ),
      meta: { skeleton: <Skeleton className="h-4 w-48" /> },
    },
    ...heads.map((h, i): ColumnDef<DataGridFeatures, Row> => ({
      id: `v${i}`, header: h, size: 150, enableSorting: false,
      cell: ({ row: { original: r } }) => {
        const v = r.v[i]
        if (v === undefined) return null
        return <span className={cn(v < 0 && 'text-destructive', (r.kind === 'head' || r.kind === 'total' || r.kind === 'strong') && 'font-semibold')}>{fmt(v)}</span>
      },
      meta: { headerClassName: 'text-end [&>div]:justify-end', cellClassName: 'text-end tabular-nums', skeleton: <Skeleton className="ml-auto h-4 w-16" /> },
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, fmt, heads.join('|')])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    getRowId: (r: Row) => String(r.id),
    // While loading, the grid draws one skeleton row per pageSize row: keep it small. Reports do not page.
    state: { pagination: { pageIndex: 0, pageSize: loading ? 10 : 10_000 } },
  })

  return (
    <>
      <PageHeader title={t('nav.reports')} description={t('rep.subtitle', { currency: base })} />
      <div className="flex items-end gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="trial">{t('rep.trial')}</TabsTrigger>
            <TabsTrigger value="balance">{t('rep.balance')}</TabsTrigger>
            <TabsTrigger value="income">{t('rep.incomeStatement')}</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === 'income' && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('gj.from')}
            <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {tab === 'income' ? t('gj.to') : t('rep.asOf')}
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value || today())} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('rep.depth')}
          <OptionSelect
            className="w-32" value={depth} onChange={setDepth}
            options={[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['9', t('rep.allLevels')]].map(([value, label]) => ({ value, label }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('scope.label')}
          <ScopeSelect />
        </label>
        <label className="ml-auto flex items-center gap-2 pb-2 text-sm text-muted-foreground">
          <Checkbox checked={showZero} onCheckedChange={(v) => setShowZero(v === true)} />
          {t('rep.showZero')}
        </label>
      </div>

      <Frame spacing="sm" stacked>
        <FramePanel className="p-0">
          <DataGrid
            table={table}
            recordCount={rows.length}
            isLoading={loading}
            tableLayout={{ dense: true, headerBackground: false, headerSticky: true }}
            emptyMessage={failed ? (
              <DataState error onRetry={() => { void accounts.refetch(); void report.refetch() }} />
            ) : (
              <DataState empty={{ title: t('rep.empty'), hint: t('rep.emptyHint'), action: (
                <Button size="sm" nativeButton={false} render={<Link to="/yevmiye" />}>{t('nav.journal')}</Button>
              ) }} />
            )}
          >
            <DataGridContainer>
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
          </DataGrid>
        </FramePanel>
        {foot && <FrameFooter className="text-xs text-muted-foreground">{foot}</FrameFooter>}
      </Frame>
    </>
  )
}
