import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Cell, Pie, PieChart } from 'recharts'
import type { Membership } from '@/auth/useMembership'
import { Upcoming } from '@/components/Upcoming'
import { RecentEntries } from '@/components/RecentEntries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/errors'
import { exponentOf, formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { FormError } from '@/components/PageShell'

type Acc = { id: string; name: string; type: string; parent_id: string | null }
type Total = { account_id: string; debit: number; credit: number }

const iso = (d: Date) => d.toLocaleDateString('sv-SE')
const SLICE_OPACITY = [1, 0.75, 0.55, 0.4, 0.28, 0.18]

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
    const byRoot = new Map<string, { name: string; value: number }>()
    for (const [id, v] of sumByAccount(month.data)) {
      const a = accs.get(id)
      if (a?.type === 'income') income += v.credit - v.debit
      if (a?.type === 'expense') {
        const net = v.debit - v.credit
        expense += net
        const r = root(id)
        if (r && net > 0) byRoot.set(r.id, { name: r.name, value: (byRoot.get(r.id)?.value ?? 0) + net })
      }
    }
    const sorted = [...byRoot.values()].sort((a, b) => b.value - a.value)
    // İlk 5 kategori + kalanı "Diğer".
    const top = sorted.slice(0, 5)
    const rest = sorted.slice(5).reduce((s, x) => s + x.value, 0)
    if (rest > 0) top.push({ name: t('dashboard.other'), value: rest })
    return { netWorth: assets - liabilities, income, expense, slices: top }
  }, [accounts.data, asOf.data, month.data, t])

  const loading = accounts.isLoading || asOf.isLoading || month.isLoading
  const error = accounts.error ?? asOf.error ?? month.error
  const net = stats.income - stats.expense
  const config: ChartConfig = Object.fromEntries(stats.slices.map((s) => [s.name, { label: s.name }]))

  return (
    <>
      <h1 className="text-2xl font-semibold">{t('home.greeting', { name: membership.displayName ?? '' })}</h1>
      <FormError message={error ? errorMessage(t, error) : null} />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardDescription>{t('dashboard.netWorth')}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {loading ? <Skeleton className="h-9 w-48" /> : money(stats.netWorth)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {([
              ['income', stats.income],
              ['expense', stats.expense],
              ['net', net],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-2 sm:flex-col sm:items-start sm:gap-1">
                <span className="text-sm text-muted-foreground">{t(`dashboard.${k}`)}</span>
                <span className="text-lg font-medium tabular-nums">{loading ? <Skeleton className="h-6 w-28" /> : money(v)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {/* Yaklaşanlar: uygulamanın üç ana yerinden biri; özetin hemen altında. */}
      <Upcoming membership={membership} />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.spending')}</CardTitle>
            <CardDescription>{t('dashboard.thisMonth')}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.slices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{loading ? '' : t('dashboard.noSpending')}</p>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <ChartContainer config={config} className="size-44 shrink-0">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" formatter={(v) => money(Number(v))} />} />
                    <Pie data={stats.slices} dataKey="value" nameKey="name" innerRadius={48} strokeWidth={2}>
                      {stats.slices.map((s, i) => (
                        <Cell key={s.name} fill="var(--primary)" fillOpacity={SLICE_OPACITY[i] ?? 0.18} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <ul className="flex w-full flex-col gap-1.5 text-sm">
                  {stats.slices.map((s, i) => (
                    <li key={s.name} className="flex items-center gap-2">
                      <span className="size-3 shrink-0 rounded-full bg-primary" style={{ opacity: SLICE_OPACITY[i] ?? 0.18 }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="tabular-nums">{money(s.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <RecentEntries membership={membership} exponent={exponentOf(base)} limit={5} />
      <Button variant="outline" nativeButton={false} render={<Link to="/islemler" />}>{t('dashboard.allEntries')}</Button>
    </>
  )
}
