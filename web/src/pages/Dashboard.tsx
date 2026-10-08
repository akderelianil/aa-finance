import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { Membership } from '@/auth/useMembership'
import { PageHeader } from '@/components/PageHeader'
import { FormError } from '@/components/PageShell'
import { Stat, StatStrip } from '@/components/StatStrip'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { topSlices } from '@/lib/chart'
import { errorMessage } from '@/lib/errors'
import { formatAmount, shown, useCurrencies, useLedgerAccounts, type AccountType } from '@/lib/ledger'
import { cumulativeNet, periodNet, rollUp, type ReportNode, type Totals } from '@/lib/reports'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Scope = 'group' | 'me'
type Period = 'month' | 'year'

const iso = (d: Date) => d.toLocaleDateString('sv-SE')
const monthKey = (d: Date) => iso(new Date(d.getFullYear(), d.getMonth(), 1))

// Home: overview of the ledger for the whole family/group or for the signed-in member only. Individual view:
// balance sheet accounts the member owns, income and expense the member posted (see dashboard_totals).
export default function Dashboard({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const base = membership.group.base_currency
  const [scope, setScope] = useState<Scope>('group')
  const [period, setPeriod] = useState<Period>('month')
  const [now] = useState(() => new Date())
  const to = iso(now)
  const from = period === 'month' ? monthKey(now) : `${now.getFullYear()}-01-01`
  const member = scope === 'me' ? membership.id : null
  // Trend chart: the last 6 months including this one.
  const trendFrom = monthKey(new Date(now.getFullYear(), now.getMonth() - 5, 1))

  const accounts = useLedgerAccounts()
  const currencies = useCurrencies()
  const exp = (currencies.data ?? []).find((c) => c.code === base)?.exponent ?? 2
  const money = (minor: number) => `${formatAmount(minor, exp, i18n.language)} ${base}`

  const totals = useQuery({
    queryKey: ['ledger', 'dashboard-totals', from, to, member],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_totals', { p_from: from, p_to: to, p_member: member })
      if (error) throw error
      return new Map((data as { account_id: string; before_debit: number; before_credit: number; debit: number; credit: number }[])
        .map((r): [string, Totals] => [r.account_id, {
          beforeDebit: Number(r.before_debit), beforeCredit: Number(r.before_credit), debit: Number(r.debit), credit: Number(r.credit),
        }]))
    },
  })
  const monthly = useQuery({
    queryKey: ['ledger', 'dashboard-monthly', trendFrom, to, member],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_monthly', { p_from: trendFrom, p_to: to, p_member: member })
      if (error) throw error
      return new Map((data as { month: string; income: number; expense: number }[])
        .map((r) => [r.month, { income: Number(r.income), expense: Number(r.expense) }]))
    },
  })

  const stats = useMemo(() => {
    const tree = accounts.data && totals.data ? rollUp(accounts.data.roots, totals.data) : []
    const root = (type: AccountType) => tree.find((r) => r.node.type === type)
    const sum = (type: AccountType, f: (x: Totals) => number) => {
      const r = root(type)
      return r ? shown(type, f(r.totals)) : 0
    }
    const assets = sum('asset', cumulativeNet)
    const liabilities = sum('liability', cumulativeNet)
    const income = sum('income', periodNet)
    const expense = sum('expense', periodNet)
    const slices = (type: AccountType) => topSlices(
      (root(type)?.children ?? []).map((c) => ({ name: c.node.name, value: shown(type, periodNet(c.totals)) })),
      6, t('dash.other'),
    )
    // Balance sheet groups (Nakit, Banka, ... / Kredi Kartı, ...) with their balance.
    const groups = (type: AccountType): { id: string; name: string; value: number }[] =>
      (root(type)?.children ?? [])
        .map((c: ReportNode) => ({ id: c.node.id, name: c.node.name, value: shown(type, cumulativeNet(c.totals)) }))
        .filter((g) => g.value !== 0)
        .sort((a, b) => b.value - a.value)
    return {
      assets, liabilities, netWorth: assets - liabilities, income, expense, net: income - expense,
      expenseSlices: slices('expense'), incomeSlices: slices('income'),
      assetGroups: groups('asset'), liabilityGroups: groups('liability'),
      topExpense: (root('expense')?.children ?? [])
        .flatMap((g) => g.children.length ? g.children : [g])
        .map((c) => ({ id: c.node.id, name: c.node.name, path: c.node.path, value: shown('expense', periodNet(c.totals)) }))
        .filter((c) => c.value > 0).sort((a, b) => b.value - a.value).slice(0, 8),
    }
  }, [accounts.data, totals.data, t])

  const trend = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const v = monthly.data?.get(monthKey(d))
    return {
      month: new Intl.DateTimeFormat(i18n.language, { month: 'short' }).format(d),
      income: (v?.income ?? 0) / 10 ** exp, expense: (v?.expense ?? 0) / 10 ** exp,
    }
  }), [monthly.data, now, i18n.language, exp])
  const trendConfig: ChartConfig = {
    income: { label: t('dash.income'), color: 'var(--chart-2)' },
    expense: { label: t('dash.expense'), color: 'var(--chart-4)' },
  }

  const loading = accounts.isLoading || totals.isLoading
  const error = accounts.error ?? totals.error ?? monthly.error
  const rate = stats.income > 0 ? Math.round((stats.net / stats.income) * 100) : null
  const periodLabel = period === 'month'
    ? new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(now)
    : String(now.getFullYear())
  const groupLabel = t(membership.group.kind === 'family' ? 'dash.family' : 'dash.community')

  return (
    <>
      <PageHeader
        title={t('nav.home')} description={`${periodLabel} · ${base}`}
        actions={(
          <>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList>
                <TabsTrigger value="month">{t('dash.thisMonth')}</TabsTrigger>
                <TabsTrigger value="year">{t('dash.thisYear')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <TabsList>
                <TabsTrigger value="group">{groupLabel}</TabsTrigger>
                <TabsTrigger value="me">{t('dash.individual')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        )}
      />
      {scope === 'me' && <p className="-mt-2 text-xs text-muted-foreground">{t('dash.individualHint')}</p>}
      <FormError message={error ? errorMessage(t, error) : null} />

      <StatStrip title={t('dash.balanceSheet')}>
        <Stat label={t('dash.assets')} value={money(stats.assets)} loading={loading} hint={t('dash.asOfToday')} />
        <Stat label={t('dash.liabilities')} value={money(stats.liabilities)} loading={loading} hint={t('dash.asOfToday')} />
        <Stat
          label={t('dash.netWorth')} value={money(stats.netWorth)} loading={loading} hint={t('dash.asOfToday')}
          tone={stats.netWorth < 0 ? 'danger' : 'neutral'}
        />
      </StatStrip>
      <StatStrip title={t('dash.periodSummary')}>
        <Stat label={t('dash.income')} value={money(stats.income)} loading={loading} hint={periodLabel} />
        <Stat label={t('dash.expense')} value={money(stats.expense)} loading={loading} hint={periodLabel} />
        <Stat
          label={t('dash.netResult')} value={money(stats.net)} loading={loading}
          tone={stats.net < 0 ? 'danger' : 'neutral'}
          badge={rate === null ? undefined : { text: t('dash.savingRate', { pct: rate }), variant: rate < 0 ? 'destructive' : 'success' }}
        />
      </StatStrip>

      <section className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>{t('dash.trend')}</CardTitle>
            <CardDescription>{t('dash.trendHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            {monthly.isLoading ? <Skeleton className="h-64 w-full" /> : (
              <ChartContainer config={trendConfig} className="h-64 w-full">
                <BarChart data={trend}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis width={72} tickLine={false} axisLine={false} tickFormatter={(v) => formatAmount(Math.round(Number(v) * 10 ** exp), exp, i18n.language)} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => money(Math.round(Number(v) * 10 ** exp))} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="income" fill="var(--color-income)" radius={2} />
                  <Bar dataKey="expense" fill="var(--color-expense)" radius={2} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <RankedList
          title={t('dash.topExpenses')} description={periodLabel} total={stats.expense} money={money} empty={t('dash.noExpense')} loading={loading}
          rows={stats.topExpense.map((c) => ({ id: c.id, name: c.name, value: c.value }))}
        />
      </section>

      <section className="grid grid-cols-3 gap-4">
        <RankedList title={t('dash.assetGroups')} total={stats.assets} money={money} empty={t('dash.noData')} loading={loading} rows={stats.assetGroups} />
        <RankedList title={t('dash.liabilityGroups')} total={stats.liabilities} money={money} empty={t('dash.noData')} loading={loading} rows={stats.liabilityGroups} />
        <RankedList
          title={t('dash.earnings')} description={periodLabel} total={stats.income} money={money} empty={t('dash.noIncome')} loading={loading}
          rows={stats.incomeSlices.map((s) => ({ id: s.name, name: s.name, value: s.value }))}
        />
      </section>
    </>
  )
}

// Ranked list: name, amount and a thin bar for the share of the total.
function RankedList({ title, description, rows, total, money, empty, loading }: {
  title: string
  description?: string
  rows: { id: string; name: string; value: number }[]
  total: number
  money: (v: number) => string
  empty: string
  loading?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-32 w-full" /> : rows.length === 0 ? (
          <Empty className="py-6"><EmptyHeader><EmptyDescription>{empty}</EmptyDescription></EmptyHeader></Empty>
        ) : (
          <Table>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-0 min-w-0">
                    <div className="flex flex-col gap-1.5">
                      <span className="truncate">{r.name}</span>
                      <Progress value={total > 0 ? Math.min(100, Math.max(0, (r.value / total) * 100)) : 0} aria-label={r.name} />
                    </div>
                  </TableCell>
                  <TableCell className={cn('w-36 text-right tabular-nums', r.value < 0 && 'text-destructive')}>{money(r.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
