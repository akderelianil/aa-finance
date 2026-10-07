import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { PageShell, FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const list = (rows: { id: string; name: string; net: number }[]) =>
    rows.sort((a, b) => b.net - a.net).map((r) => (
      <div key={r.id} className="flex justify-between gap-2 text-sm">
        <span className="truncate">{r.name}</span><span>{money(r.net)}</span>
      </div>
    ))
  const total = (label: string, v: number) => (
    <div className="flex justify-between border-t pt-2 font-medium"><span>{label}</span><span>{money(v)}</span></div>
  )

  const error = accounts.error ?? periodTotals.error ?? asOfTotals.error ?? flow.error

  return (
    <PageShell>
      <div className="grid grid-cols-4 gap-1">
        {(['summary', 'worth', 'cash', 'detail'] as const).map((k) => (
          <Button key={k} size="sm" variant={tab === k ? 'default' : 'outline'} onClick={() => setTab(k)}>{t(`reports.tab.${k}`)}</Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {([false, true] as const).map((v) => (
          <Button key={String(v)} size="sm" variant={mine === v ? 'secondary' : 'ghost'} onClick={() => setMine(v)}>
            {t(v ? 'reports.me' : 'reports.family')}
          </Button>
        ))}
      </div>
      {tab !== 'worth' && (
        <div className="grid grid-cols-4 gap-1">
          {(['month', 'lastMonth', 'year', 'all'] as const).map((p) => (
            <Button key={p} size="sm" variant={period === p ? 'secondary' : 'ghost'} onClick={() => setPeriod(p)}>
              {t(`reports.period.${p}`)}
            </Button>
          ))}
        </div>
      )}
      <FormError message={error ? errorMessage(t, error) : null} />

      {tab === 'summary' && (
        <>
          <Card>
            <CardHeader><CardTitle>{t('reports.income')}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {income.length === 0 && <p className="text-sm text-muted-foreground">{t('reports.none')}</p>}
              {list(income)}
              {total(t('reports.totalIncome'), sum(income))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t('reports.expense')}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {expense.length === 0 && <p className="text-sm text-muted-foreground">{t('reports.none')}</p>}
              {list(expense)}
              {total(t('reports.totalExpense'), sum(expense))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">{total(t('reports.net'), sum(income) - sum(expense))}</CardContent>
          </Card>
        </>
      )}

      {tab === 'worth' && (
        <>
          <Card>
            <CardHeader><CardTitle>{t('reports.assets')}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {list(assets)}
              {total(t('reports.totalAssets'), sum(assets))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t('reports.liabilities')}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {liabilities.length === 0 && <p className="text-sm text-muted-foreground">{t('reports.none')}</p>}
              {list(liabilities)}
              {total(t('reports.totalLiabilities'), sum(liabilities))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">{total(t('reports.netWorth'), sum(assets) - sum(liabilities))}</CardContent>
          </Card>
        </>
      )}

      {tab === 'cash' && (
        <Card>
          <CardHeader><CardTitle>{t('reports.tab.cash')}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex justify-between text-sm"><span>{t('reports.inflow')}</span><span className="text-green-600">{money(inflow)}</span></div>
            <div className="flex justify-between text-sm"><span>{t('reports.outflow')}</span><span>{money(outflow)}</span></div>
            {total(t('reports.net'), inflow - outflow)}
            <p className="text-xs text-muted-foreground">{t('reports.cashNote')}</p>
          </CardContent>
        </Card>
      )}

      {tab === 'detail' && (
        <Card>
          <CardHeader><CardTitle>{t('reports.detail')}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-xs text-muted-foreground">
              <span>{t('reports.account')}</span><span className="text-right">{t('reports.debit')}</span><span className="text-right">{t('reports.credit')}</span>
            </div>
            {period_.sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
              <div key={a.id} className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-sm">
                <span className="truncate">{a.name}</span>
                <span className="text-right">{money(a.debit)}</span>
                <span className="text-right">{money(a.credit)}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-t pt-2 font-medium">
              <span>{t('reports.total')}</span>
              <span className="text-right">{money(period_.reduce((s, a) => s + a.debit, 0))}</span>
              <span className="text-right">{money(period_.reduce((s, a) => s + a.credit, 0))}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  )
}
