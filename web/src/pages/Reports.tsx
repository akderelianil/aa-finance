import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowUpRightIcon, BanknoteIcon, ChartPieIcon, CreditCardIcon, LandmarkIcon, ListIcon,
  PiggyBankIcon, ScaleIcon, ShoppingBagIcon, TrendingDownIcon, TrendingUpIcon, UserIcon, UsersIcon, WalletIcon, type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import type { Membership } from '@/auth/useMembership'
import { PageShell, FormError } from '@/components/PageShell'
import { CategoryPie } from '@/components/CategoryPie'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { topSlices } from '@/lib/chart'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/lib/errors'
import { formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'

type Tab = 'summary' | 'worth' | 'cash' | 'detail'
type Period = 'month' | 'lastMonth' | 'year' | 'all'
type Account = { id: string; name: string; type: string; subtype: string | null }
type Total = { member_id: string; account_id: string; debit: number; credit: number }
type Flow = { member_id: string; inflow: number; outflow: number }

const iso = (d: Date) => d.toLocaleDateString('sv-SE')

// Dönem sınırları (dahil). Tüm zamanlar: from = null.
function range(p: Period): { from: string | null; to: string | null } {
  const now = new Date()
  if (p === 'month') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }
  if (p === 'lastMonth') {
    return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) }
  }
  if (p === 'year') return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) }
  return { from: null, to: iso(now) }
}

export default function Reports({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const currency = membership.group.base_currency
  const [tab, setTab] = useState<Tab>('summary')
  const [period, setPeriod] = useState<Period>('month')
  const [mine, setMine] = useState(false)
  const { from, to } = range(period)
  const money = (v: number) => formatMinor(v, currency, i18n.language)

  const accounts = useQuery({
    queryKey: ['report-accounts', membership.group.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('id, name, type, subtype').eq('group_id', membership.group.id)
      if (error) throw error
      return new Map((data as Account[]).map((a) => [a.id, a]))
    },
  })

  const periodTotals = useQuery({
    queryKey: ['report-totals', membership.group.id, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_totals', { p_from: from, p_to: to })
      if (error) throw error
      return data as Total[]
    },
  })

  const asOfTotals = useQuery({
    queryKey: ['report-asof', membership.group.id, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_totals', { p_from: null, p_to: to })
      if (error) throw error
      return data as Total[]
    },
  })

  const flow = useQuery({
    queryKey: ['report-flow', membership.group.id, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_cash_flow', { p_from: from, p_to: to })
      if (error) throw error
      return data as Flow[]
    },
  })

  // Üye filtresi + hesap bazında topla.
  function byAccount(rows: Total[] | undefined) {
    const m = new Map<string, { debit: number; credit: number }>()
    for (const r of rows ?? []) {
      if (mine && r.member_id !== membership.id) continue
      const cur = m.get(r.account_id) ?? { debit: 0, credit: 0 }
      cur.debit += Number(r.debit)
      cur.credit += Number(r.credit)
      m.set(r.account_id, cur)
    }
    return [...m.entries()].flatMap(([id, v]) => {
      const a = accounts.data?.get(id)
      return a ? [{ ...a, ...v }] : []
    })
  }

  const period_ = byAccount(periodTotals.data)
  const income = period_.filter((a) => a.type === 'income').map((a) => ({ ...a, net: a.credit - a.debit })).filter((a) => a.net !== 0)
  const expense = period_.filter((a) => a.type === 'expense').map((a) => ({ ...a, net: a.debit - a.credit })).filter((a) => a.net !== 0)
  const sum = (xs: { net: number }[]) => xs.reduce((s, x) => s + x.net, 0)

  const asOf = byAccount(asOfTotals.data)
  const assets = asOf.filter((a) => a.type === 'asset').map((a) => ({ ...a, net: a.debit - a.credit })).filter((a) => a.net !== 0)
  const liabilities = asOf.filter((a) => a.type === 'liability').map((a) => ({ ...a, net: a.credit - a.debit })).filter((a) => a.net !== 0)

  const cash = (flow.data ?? []).filter((f) => !mine || f.member_id === membership.id)
  const inflow = cash.reduce((s, f) => s + Number(f.inflow), 0)
  const outflow = cash.reduce((s, f) => s + Number(f.outflow), 0)

  const slicesOf = (rows: { name: string; net: number }[]) =>
    topSlices(rows.map((r) => ({ name: r.name, value: r.net })), 6, t('dashboard.other'))

  // Hesap listesi: ada göre büyükten küçüğe, toplam satırı altta.
  const table = (rows: { id: string; name: string; net: number }[], totalLabel: string, tone: string) => (
    <Table>
      <TableBody>
        {[...rows].sort((a, b) => b.net - a.net).map((r) => (
          <TableRow key={r.id}>
            <TableCell className="max-w-0 truncate">{r.name}</TableCell>
            <TableCell className="text-right tabular-nums">{money(r.net)}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow className="hover:bg-transparent"><TableCell colSpan={2} className="text-muted-foreground">{t('reports.none')}</TableCell></TableRow>
        )}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-semibold">{totalLabel}</TableCell>
          <TableCell className={cn('text-right font-semibold tabular-nums', tone)}>{money(sum(rows))}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )

  const error = accounts.error ?? periodTotals.error ?? asOfTotals.error ?? flow.error
  const loading = accounts.isLoading || periodTotals.isLoading || asOfTotals.isLoading || flow.isLoading
  const netIncome = sum(income) - sum(expense)
  const netWorth = sum(assets) - sum(liabilities)
  const flowConfig: ChartConfig = {
    inflow: { label: t('reports.inflow'), color: 'var(--chart-2)' },
    outflow: { label: t('reports.outflow'), color: 'var(--chart-4)' },
  }

  const listCard = (title: string, icon: LucideIcon, children: ReactNode) => {
    const Icon = icon
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" aria-hidden />{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    )
  }

  return (
    <PageShell>
      <PageHeader title={t('reports.title')} icon={ChartPieIcon} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="w-full">
          {([['summary', ScaleIcon], ['worth', LandmarkIcon], ['cash', ArrowLeftRightIcon], ['detail', ListIcon]] as const).map(([k, Icon]) => (
            <TabsTrigger key={k} value={k}><Icon />{t(`reports.tab.${k}`)}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup value={[mine ? 'me' : 'family']} spacing={2} aria-label={t('reports.family')}
          onValueChange={(v) => { if (v[0]) setMine(v[0] === 'me') }}>
          <ToggleGroupItem value="family" variant="outline" size="sm"><UsersIcon />{t('reports.family')}</ToggleGroupItem>
          <ToggleGroupItem value="me" variant="outline" size="sm"><UserIcon />{t('reports.me')}</ToggleGroupItem>
        </ToggleGroup>
        {tab !== 'worth' && (
          <ToggleGroup value={[period]} spacing={2} aria-label={t('reports.tab.summary')}
            onValueChange={(v) => { if (v[0]) setPeriod(v[0] as Period) }}>
            {(['month', 'lastMonth', 'year', 'all'] as const).map((p) => (
              <ToggleGroupItem key={p} value={p} variant="outline" size="sm">{t(`reports.period.${p}`)}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>
      <FormError message={error ? errorMessage(t, error) : null} />

      {tab === 'summary' && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label={t('reports.totalIncome')} value={money(sum(income))} icon={TrendingUpIcon} tone="success" loading={loading} />
            <StatCard label={t('reports.totalExpense')} value={money(sum(expense))} icon={TrendingDownIcon} tone="danger" loading={loading} />
            <StatCard label={t('reports.net')} value={money(netIncome)} icon={PiggyBankIcon} tone={netIncome < 0 ? 'danger' : 'success'} loading={loading} />
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <CategoryPie title={t('reports.income')} description={t(`reports.period.${period}`)} icon={BanknoteIcon}
              slices={slicesOf(income)} empty={t('reports.none')} loading={loading} money={money} />
            <CategoryPie title={t('reports.expense')} description={t(`reports.period.${period}`)} icon={ShoppingBagIcon}
              slices={slicesOf(expense)} empty={t('reports.none')} loading={loading} money={money} />
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            {listCard(t('reports.income'), TrendingUpIcon, table(income, t('reports.totalIncome'), 'text-success'))}
            {listCard(t('reports.expense'), TrendingDownIcon, table(expense, t('reports.totalExpense'), 'text-destructive'))}
          </section>
        </>
      )}

      {tab === 'worth' && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label={t('reports.totalAssets')} value={money(sum(assets))} icon={WalletIcon} tone="info" loading={loading} />
            <StatCard label={t('reports.totalLiabilities')} value={money(sum(liabilities))} icon={CreditCardIcon} tone="warning" loading={loading} />
            <StatCard label={t('reports.netWorth')} value={money(netWorth)} icon={LandmarkIcon} tone={netWorth < 0 ? 'danger' : 'success'} loading={loading} />
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            <CategoryPie title={t('reports.assets')} description={t('dashboard.asOfToday')} icon={WalletIcon}
              slices={slicesOf(assets)} empty={t('reports.none')} loading={loading} money={money} />
            <CategoryPie title={t('reports.liabilities')} description={t('dashboard.asOfToday')} icon={CreditCardIcon}
              slices={slicesOf(liabilities)} empty={t('reports.none')} loading={loading} money={money} />
          </section>
          <section className="grid gap-4 lg:grid-cols-2">
            {listCard(t('reports.assets'), WalletIcon, table(assets, t('reports.totalAssets'), 'text-info'))}
            {listCard(t('reports.liabilities'), CreditCardIcon, table(liabilities, t('reports.totalLiabilities'), 'text-warning'))}
          </section>
        </>
      )}

      {tab === 'cash' && (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard label={t('reports.inflow')} value={money(inflow)} icon={ArrowDownLeftIcon} tone="success" loading={loading} />
            <StatCard label={t('reports.outflow')} value={money(outflow)} icon={ArrowUpRightIcon} tone="danger" loading={loading} />
            <StatCard label={t('reports.net')} value={money(inflow - outflow)} icon={ScaleIcon} tone={inflow - outflow < 0 ? 'danger' : 'success'} loading={loading} />
          </section>
          {listCard(t('reports.tab.cash'), ArrowLeftRightIcon, (
            <div className="flex flex-col gap-3">
              <ChartContainer config={flowConfig} className="h-48 w-full">
                <BarChart data={[{ name: t('reports.tab.cash'), inflow: inflow / 100, outflow: outflow / 100 }]} barGap={8}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => money(Number(v) * 100)} />} />
                  <Bar dataKey="inflow" fill="var(--color-inflow)" radius={8} />
                  <Bar dataKey="outflow" fill="var(--color-outflow)" radius={8} />
                </BarChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground">{t('reports.cashNote')}</p>
            </div>
          ))}
        </>
      )}

      {tab === 'detail' && listCard(t('reports.detail'), ListIcon, (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('reports.account')}</TableHead>
              <TableHead className="text-right">{t('reports.debit')}</TableHead>
              <TableHead className="text-right">{t('reports.credit')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...period_].sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="max-w-0 truncate">{a.name}</TableCell>
                <TableCell className="text-right tabular-nums">{money(a.debit)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(a.credit)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">{t('reports.total')}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{money(period_.reduce((s, a) => s + a.debit, 0))}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{money(period_.reduce((s, a) => s + a.credit, 0))}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      ))}
    </PageShell>
  )
}
