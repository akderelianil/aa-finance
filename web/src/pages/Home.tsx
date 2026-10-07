import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BanknoteIcon, CreditCardIcon, LandmarkIcon, LayoutDashboardIcon, PiggyBankIcon, ShoppingBagIcon, TrendingDownIcon, TrendingUpIcon, WalletIcon,
} from 'lucide-react'
import type { Membership } from '@/auth/useMembership'
import { Upcoming } from '@/components/Upcoming'
import { RecentEntries } from '@/components/RecentEntries'
import { CategoryPie } from '@/components/CategoryPie'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { topSlices } from '@/lib/chart'
import { errorMessage } from '@/lib/errors'
import { exponentOf, formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { FormError } from '@/components/PageShell'

type Acc = { id: string; name: string; type: string; parent_id: string | null }
type Total = { account_id: string; debit: number; credit: number }

const iso = (d: Date) => d.toLocaleDateString('sv-SE')

function sumByAccount(rows: Total[] | undefined) {
  const m = new Map<string, { debit: number; credit: number }>()
  for (const r of rows ?? []) {
    const cur = m.get(r.account_id) ?? { debit: 0, credit: 0 }
    cur.debit += Number(r.debit)
    cur.credit += Number(r.credit)
    m.set(r.account_id, cur)
  }
  return m
}

export default function Home({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const groupId = membership.group.id
  const base = membership.group.base_currency
  const money = (v: number) => formatMinor(v, base, i18n.language)
  const [now] = useState(() => new Date())
  const monthFrom = iso(new Date(now.getFullYear(), now.getMonth(), 1))
  const today = iso(now)

  const accounts = useQuery({
    queryKey: ['dash-accounts', groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('id, name, type, parent_id').eq('group_id', groupId)
      if (error) throw error
      return data as Acc[]
    },
  })
  const month = useQuery({
    queryKey: ['entries', groupId, 'dash-month', monthFrom, today],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_totals', { p_from: monthFrom, p_to: today })
      if (error) throw error
      return data as Total[]
    },
  })
  const asOf = useQuery({
    queryKey: ['entries', groupId, 'dash-asof', today],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('report_totals', { p_from: null, p_to: today })
      if (error) throw error
      return data as Total[]
    },
  })
  const stats = useMemo(() => {
    const accs = new Map((accounts.data ?? []).map((a) => [a.id, a]))
    const root = (id: string): Acc | undefined => {
      let a = accs.get(id)
      while (a?.parent_id && accs.get(a.parent_id)) a = accs.get(a.parent_id)
      return a
    }
    let assets = 0, liabilities = 0
    for (const [id, v] of sumByAccount(asOf.data)) {
      const a = accs.get(id)
      if (a?.type === 'asset') assets += v.debit - v.credit
      if (a?.type === 'liability') liabilities += v.credit - v.debit
    }
    let income = 0, expense = 0
    const expRoots = new Map<string, { name: string; value: number }>()
    const incRoots = new Map<string, { name: string; value: number }>()
    for (const [id, v] of sumByAccount(month.data)) {
      const a = accs.get(id)
      if (a?.type !== 'income' && a?.type !== 'expense') continue
      const isInc = a.type === 'income'
      const net = isInc ? v.credit - v.debit : v.debit - v.credit
      if (isInc) income += net
      else expense += net
      const r = root(id)
      const bucket = isInc ? incRoots : expRoots
      if (r && net > 0) bucket.set(r.id, { name: r.name, value: (bucket.get(r.id)?.value ?? 0) + net })
    }
    return {
      assets, liabilities, netAsset: assets - liabilities, income, expense, netIncome: income - expense,
      expenseSlices: topSlices([...expRoots.values()], 6, t('dashboard.other')),
      incomeSlices: topSlices([...incRoots.values()], 6, t('dashboard.other')),
    }
  }, [accounts.data, asOf.data, month.data, t])

  const loading = accounts.isLoading || asOf.isLoading || month.isLoading
  const error = accounts.error ?? asOf.error ?? month.error
  const monthName = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(now)
  const rate = stats.income > 0 ? Math.round((stats.netIncome / stats.income) * 100) : null

  return (
    <>
      <PageHeader
        title={t('home.greeting', { name: membership.displayName ?? '' })}
        description={monthName}
        icon={LayoutDashboardIcon}
      />
      <FormError message={error ? errorMessage(t, error) : null} />
      <section className="grid gap-4 sm:grid-cols-3" aria-label={t('dashboard.balanceSheet')}>
        <StatCard label={t('dashboard.totalAsset')} value={money(stats.assets)} icon={WalletIcon} tone="info" loading={loading} hint={t('dashboard.asOfToday')} />
        <StatCard label={t('dashboard.totalLiability')} value={money(stats.liabilities)} icon={CreditCardIcon} tone="warning" loading={loading} hint={t('dashboard.asOfToday')} />
        <StatCard
          label={t('dashboard.netAsset')} value={money(stats.netAsset)} icon={LandmarkIcon}
          tone={stats.netAsset < 0 ? 'danger' : 'success'} loading={loading} hint={t('dashboard.asOfToday')}
        />
      </section>
      <section className="grid gap-4 sm:grid-cols-3" aria-label={t('dashboard.thisMonthTitle')}>
        <StatCard label={t('dashboard.totalExpense')} value={money(stats.expense)} icon={TrendingDownIcon} tone="danger" loading={loading} hint={t('dashboard.thisMonthShort')} />
        <StatCard label={t('dashboard.totalIncome')} value={money(stats.income)} icon={TrendingUpIcon} tone="success" loading={loading} hint={t('dashboard.thisMonthShort')} />
        <StatCard
          label={t('dashboard.netIncome')} value={money(stats.netIncome)} icon={PiggyBankIcon}
          tone={stats.netIncome < 0 ? 'danger' : 'success'} loading={loading}
          badge={rate === null ? undefined : { text: t('dashboard.savingRate', { pct: rate }), variant: rate < 0 ? 'destructive' : 'success' }}
        />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <CategoryPie
          title={t('dashboard.spending')} description={t('dashboard.thisMonth')} icon={ShoppingBagIcon}
          slices={stats.expenseSlices} empty={t('dashboard.noSpending')} loading={loading} money={money}
        />
        <CategoryPie
          title={t('dashboard.earnings')} description={t('dashboard.thisMonthIncome')} icon={BanknoteIcon}
          slices={stats.incomeSlices} empty={t('dashboard.noEarnings')} loading={loading} money={money}
        />
      </section>
      {/* Yaklaşanlar: uygulamanın üç ana yerinden biri; özetin hemen altında. */}
      <Upcoming membership={membership} />
      <RecentEntries membership={membership} exponent={exponentOf(base)} limit={8} />
    </>
  )
}
