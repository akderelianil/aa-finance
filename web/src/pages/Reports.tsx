import { useTable, type ColumnDef } from '@tanstack/react-table'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { DataState } from '@/components/DataState'
import { OptionSelect } from '@/components/OptionSelect'
import { PageHeader } from '@/components/PageHeader'
import { CompositionBar } from '@/components/StatStrip'
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { Frame, FrameFooter, FramePanel } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { today } from '@/lib/journal'
import { formatAmount, shown, useCurrencies, useLedgerAccounts, type AccountType } from '@/lib/ledger'
import { cumulativeNet, isEmpty, periodNet, rollUp, usePeriodTotals, type ReportNode, type Totals } from '@/lib/reports'
import { cn } from '@/lib/utils'

type Tab = 'trial' | 'balance' | 'income'
type Row = { id: string; label: string; depth: number; kind: 'head' | 'strong' | 'group' | 'row' | 'total'; v: number[] }

// Reports in the base currency: Trial Balance (Mizan, cumulative to the end date), Balance Sheet (Bilanço, at the
// end date) and Income Statement (Gelir Tablosu, for the period).
export default function Reports({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const base = membership.group.base_currency
  const [tab, setTab] = useState<Tab>('trial')
  const [from, setFrom] = useState(`${today().slice(0, 4)}-01-01`)
  const [to, setTo] = useState(today())
  const [depth, setDepth] = useState('9')
  const [showZero, setShowZero] = useState(false)

  const accounts = useLedgerAccounts()
  const currencies = useCurrencies()
  const totals = usePeriodTotals(from, to)
  const exp = (currencies.data ?? []).find((c) => c.code === base)?.exponent ?? 2
  const fmt = (minor: number) => formatAmount(minor, exp, i18n.language)

  const tree = useMemo(
    () => (accounts.data && totals.data ? rollUp(accounts.data.roots, totals.data) : []),
    [accounts.data, totals.data],
  )
  const ofType = (...types: AccountType[]) => tree.filter((r) => types.includes(r.node.type))
  const maxDepth = Number(depth)

  // Flat report rows of a tree down to the chosen depth; zero rows are hidden unless asked.
  function treeRows(nodes: ReportNode[], values: (r: ReportNode) => number[], out: Row[] = []): Row[] {
    for (const r of nodes) {
      if ((!showZero && isEmpty(r.totals)) || r.node.depth >= maxDepth) continue
      out.push({ id: r.node.id, label: r.node.name, depth: r.node.depth, kind: r.node.depth === 0 ? 'strong' : r.children.length ? 'group' : 'row', v: values(r) })
      treeRows(r.children, values, out)
    }
    return out
  }
  const sum = (nodes: ReportNode[], f: (x: Totals) => number) => nodes.reduce((s, r) => s + f(r.totals), 0)

  const loading = accounts.isLoading || totals.isLoading

  // Balance sheet: net income to date (unclosed income − expense) goes to equity.
  const income = ofType('income')
  const expense = ofType('expense')
  const netIncomeToDate = -sum(income, cumulativeNet) - sum(expense, cumulativeNet)
  const netIncomePeriod = -sum(income, periodNet) - sum(expense, periodNet)

  function section(title: string, nodes: ReportNode[], value: (r: ReportNode) => number, extra?: Row[], total?: number): Row[] {
    return [
      { id: `h-${title}`, label: title, depth: 0, kind: 'head', v: [] },
      ...treeRows(nodes, (r) => [value(r)]),
      ...(extra ?? []),
      { id: `t-${title}`, label: t('rep.total', { name: title }), depth: 0, kind: 'total', v: [total ?? nodes.reduce((s, r) => s + value(r), 0)] },
    ]
  }

  const trialRows = (): Row[] => {
    const d = sum(tree, (x) => x.beforeDebit + x.debit)
    const c = sum(tree, (x) => x.beforeCredit + x.credit)
    const db = tree.reduce((s, r) => s + Math.max(cumulativeNet(r.totals), 0), 0)
    const cb = tree.reduce((s, r) => s + Math.max(-cumulativeNet(r.totals), 0), 0)
    return [
      ...treeRows(tree, (r) => {
        const d = r.totals.beforeDebit + r.totals.debit
        const c = r.totals.beforeCredit + r.totals.credit
        return [d, c, Math.max(d - c, 0), Math.max(c - d, 0)]
      }),
      { id: 'grand', label: t('rep.grandTotal'), depth: 0, kind: 'total', v: [d, c, db, cb] },
    ]
  }

  const assets = ofType('asset')
  const liabilities = ofType('liability')
  const equity = ofType('equity')
  const bsVal = (r: ReportNode) => shown(r.node.type, cumulativeNet(r.totals))
  const totalAssets = assets.reduce((s, r) => s + bsVal(r), 0)
  const totalLiab = liabilities.reduce((s, r) => s + bsVal(r), 0)
  const totalEquity = equity.reduce((s, r) => s + bsVal(r), 0) + netIncomeToDate
  const isVal = (r: ReportNode) => shown(r.node.type, periodNet(r.totals))
  const netLabel = (n: number) => t(n >= 0 ? 'rep.netProfit' : 'rep.netLoss')

  const config: Record<Tab, { heads: string[]; rows: () => Row[]; segments: { key: string; label: string; value: number; color: string }[]; foot?: ReactNode }> = {
    trial: {
      heads: [t('rep.debitTotal'), t('rep.creditTotal'), t('rep.debitBalance'), t('rep.creditBalance')],
      rows: trialRows, segments: [],
    },
    balance: {
      heads: [t('ledger.balance')],
      rows: () => [
        ...section(t('ledger.typePlural.asset'), assets, bsVal),
        ...section(t('ledger.typePlural.liability'), liabilities, bsVal),
        ...section(t('ledger.typePlural.equity'), equity, bsVal,
          [{ id: 'net', label: netLabel(netIncomeToDate), depth: 1, kind: 'row', v: [netIncomeToDate] }], totalEquity),
        { id: 'sources', label: t('rep.totalSources'), depth: 0, kind: 'total', v: [totalLiab + totalEquity] },
      ],
      segments: [
        { key: 'l', label: t('ledger.typePlural.liability'), value: totalLiab, color: 'var(--chart-4)' },
        { key: 'e', label: t('ledger.typePlural.equity'), value: totalEquity, color: 'var(--primary)' },
      ],
      foot: totalAssets === totalLiab + totalEquity
        ? <span>{t('rep.balanced')}</span>
        : <span className="font-medium text-destructive">{t('rep.unbalanced', { amount: fmt(totalAssets - totalLiab - totalEquity) })}</span>,
    },
    income: {
      heads: [t('ledger.balance')],
      rows: () => [
        ...section(t('ledger.typePlural.income'), income, isVal),
        ...section(t('ledger.typePlural.expense'), expense, isVal),
        { id: 'net', label: netLabel(netIncomePeriod), depth: 0, kind: 'total', v: [netIncomePeriod] },
      ],
      segments: [
        { key: 'x', label: t('ledger.typePlural.expense'), value: sum(expense, periodNet), color: 'var(--chart-4)' },
        { key: 'n', label: netLabel(netIncomePeriod), value: netIncomePeriod, color: 'var(--chart-2)' },
      ],
    },
  }
  const cfg = config[tab]
  const data = useMemo(() => (loading ? [] : cfg.rows()), [loading, cfg.rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo<ColumnDef<DataGridFeatures, Row>[]>(() => [
    {
      id: 'name', header: t('ledger.account'), minSize: 260, enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <span style={{ paddingLeft: `${r.depth * 1.25}rem` }} className={cn('truncate', r.kind !== 'row' && 'font-medium', (r.kind === 'head' || r.kind === 'total') && 'font-semibold')}>
          {r.label}
        </span>
      ),
      meta: { skeleton: <Skeleton className="h-4 w-48" /> },
    },
    ...cfg.heads.map((h, i): ColumnDef<DataGridFeatures, Row> => ({
      id: `v${i}`, header: h, size: 150, enableSorting: false,
      cell: ({ row: { original: r } }) => {
        const v = r.v[i]
        if (v === undefined) return null
        return <span className={cn(v < 0 && 'text-destructive', r.kind !== 'row' && r.kind !== 'group' && 'font-semibold')}>{fmt(v)}</span>
      },
      meta: { headerClassName: 'text-end [&>div]:justify-end', cellClassName: 'text-end tabular-nums', skeleton: <Skeleton className="ml-auto h-4 w-16" /> },
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, i18n.language, exp, cfg.heads.join('|')])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data,
    getRowId: (r: Row) => r.id,
    // While loading, the grid draws one skeleton row per pageSize row: keep it small.
    state: { pagination: { pageIndex: 0, pageSize: loading ? 10 : 5000 } },
  })
  const failed = accounts.isError || totals.isError

  return (
    <>
      <PageHeader title={t('rep.title')} description={t('rep.subtitle', { currency: base })} />
      <div className="flex items-end gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="trial">{t('rep.trial')}</TabsTrigger>
            <TabsTrigger value="balance">{t('rep.balance')}</TabsTrigger>
            <TabsTrigger value="income">{t('rep.income')}</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab !== 'balance' && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('gj.from')}
            <Input type="date" className="h-8 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {tab === 'balance' ? t('rep.asOf') : t('gj.to')}
          <Input type="date" className="h-8 w-40" value={to} onChange={(e) => setTo(e.target.value || today())} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('rep.depth')}
          <OptionSelect
            className="h-8 w-32" value={depth} onChange={setDepth}
            options={[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['9', t('rep.allLevels')]].map(([value, label]) => ({ value, label }))}
          />
        </label>
        <label className="ml-auto flex items-center gap-2 pb-2 text-sm text-muted-foreground">
          <Checkbox checked={showZero} onCheckedChange={(v) => setShowZero(v === true)} />
          {t('rep.showZero')}
        </label>
      </div>

      <Frame spacing="sm" stacked>
        {cfg.segments.length > 0 && !loading && (
          <FramePanel>
            <CompositionBar format={fmt} segments={cfg.segments} />
          </FramePanel>
        )}
        <FramePanel className="p-0">
          <DataGrid
            table={table}
            recordCount={data.length}
            isLoading={loading}
            tableLayout={{ dense: true, headerBackground: false, headerSticky: true }}
            emptyMessage={failed ? (
              <DataState error onRetry={() => { accounts.refetch(); totals.refetch() }} />
            ) : (
              <DataState empty={{ title: t('rep.empty'), hint: t('rep.emptyHint'), action: (
                <Button size="sm" nativeButton={false} render={<Link to="/yevmiye" />}>{t('gj.new')}</Button>
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
        {cfg.foot && !loading && <FrameFooter className="text-xs text-muted-foreground">{cfg.foot}</FrameFooter>}
      </Frame>
    </>
  )
}
