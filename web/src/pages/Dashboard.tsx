import { useQuery } from '@tanstack/react-query'
import {
  BanknoteIcon, CreditCardIcon, LandmarkIcon, LayoutDashboardIcon, PiggyBankIcon, ShoppingBagIcon, TrendingDownIcon,
  TrendingUpIcon, WalletIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { Membership } from '@/auth/useMembership'
import { CategoryPie } from '@/components/CategoryPie'
import { PageHeader } from '@/components/PageHeader'
import { FormError } from '@/components/PageShell'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
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
        title={t('nav.home')} description={`${periodLabel} · ${base}`} icon={LayoutDashboardIcon}
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

      <section className="grid grid-cols-3 gap-4" aria-label={t('dash.balanceSheet')}>
        <StatCard label={t('dash.assets')} value={money(stats.assets)} icon={WalletIcon} tone="info" loading={loading} hint={t('dash.asOfToday')} />
        <StatCard label={t('dash.liabilities')} value={money(stats.liabilities)} icon={CreditCardIcon} tone="warning" loading={loading} hint={t('dash.asOfToday')} />
        <StatCard
          label={t('dash.netWorth')} value={money(stats.netWorth)} icon={LandmarkIcon}
          tone={stats.netWorth < 0 ? 'danger' : 'success'} loading={loading} hint={t('dash.asOfToday')}
        />
      </section>
      <section className="grid grid-cols-3 gap-4" aria-label={t('dash.periodSummary')}>
        <StatCard label={t('dash.income')} value={money(stats.income)} icon={TrendingUpIcon} tone="success" loading={loading} hint={periodLabel} />
        <StatCard label={t('dash.expense')} value={money(stats.expense)} icon={TrendingDownIcon} tone="danger" loading={loading} hint={periodLabel} />
        <StatCard
          label={t('dash.netResult')} value={money(stats.net)} icon={PiggyBankIcon}
          tone={stats.net < 0 ? 'danger' : 'success'} loading={loading}
          badge={rate === null ? undefined : { text: t('dash.savingRate', { pct: rate }), variant: rate < 0 ? 'destructive' : 'success' }}
        />
      </section>

      <section className="grid grid-cols-2 gap-4">
        <CategoryPie
          title={t('dash.spending')} description={periodLabel} icon={ShoppingBagIcon}
          slices={stats.expenseSlices} empty={t('dash.noExpense')} loading={loading} money={money}
        />
        <CategoryPie
          title={t('dash.earnings')} description={periodLabel} icon={BanknoteIcon}
          slices={stats.incomeSlices} empty={t('dash.noIncome')} loading={loading} money={money}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t('dash.trend')}</CardTitle>
          <CardDescription>{t('dash.trendHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {monthly.isLoading ? <Skeleton className="h-56 w-full" /> : (
            <ChartContainer config={trendConfig} className="h-56 w-full">
              <BarChart data={trend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis width={72} tickLine={false} axisLine={false} tickFormatter={(v) => formatAmount(Math.round(Number(v) * 10 ** exp), exp, i18n.language)} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => money(Math.round(Number(v) * 10 ** exp))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="income" fill="var(--color-income)" radius={4} />
                <Bar dataKey="expense" fill="var(--color-expense)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <section className="grid grid-cols-3 gap-4">
        <BalanceTable title={t('dash.assetGroups')} rows={stats.assetGroups} total={stats.assets} money={money} empty={t('dash.noData')} loading={loading} />
        <BalanceTable title={t('dash.liabilityGroups')} rows={stats.liabilityGroups} total={stats.liabilities} money={money} empty={t('dash.noData')} loading={loading} />
        <BalanceTable
          title={t('dash.topExpenses')} total={stats.expense} money={money} empty={t('dash.noExpense')} loading={loading}
          rows={stats.topExpense.map((c) => ({ id: c.id, name: c.name, value: c.value }))}
        />
      </section>
    </>
  )
}

// Small table card: name, amount and share of the total.
function BalanceTable({ title, rows, total, money, empty, loading }: {
  title: string
  rows: { id: string; name: string; value: number }[]
  total: number
  money: (v: number) => string
  empty: string
  loading?: boolean
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-32 w-full" /> : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 [&>td]:py-1.5">
                  <td className="truncate">{r.name}</td>
                  <td className="w-14 text-right">
                    {total > 0 && <Badge variant="secondary">{Math.round((r.value / total) * 100)}%</Badge>}
                  </td>
                  <td className={cn('w-32 text-right font-mono tabular-nums', r.value < 0 && 'text-destructive')}>{money(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
