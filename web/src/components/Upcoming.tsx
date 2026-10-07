import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClockIcon, CreditCardIcon, HandCoinsIcon, LandmarkIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { useEntryDialog } from '@/components/EntryDialog'
import { FormError } from '@/components/PageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { callFunction } from '@/lib/api'
import { today } from '@/lib/entry'
import { errorMessage } from '@/lib/errors'
import { exponentOf, formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type CardDue = { account_id: string; name: string; due_date: string; statement_debt: number; paid_since: number }
type LoanDue = {
  account_id: string; name: string; installment_count: number; paid_count: number; next_due_date: string
  due_amount: number; current_debt: number
}
type PlanRow = { id: string; contact_id: string; due_date: string; contact: { name: string } | null }
type Balance = { contact_id: string; net_base_amount: number; contact: { name: string } | null }

type Item = {
  key: string
  kind: 'card' | 'debt' | 'loan'
  title: string
  detail: string
  date: string | null // null = tarihsiz (bekleyen alacak/borç)
  amount: number // minor, pozitif
  cardId?: string
  contact?: string
  planId?: string
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Yaklaşanlar: kart son ödemeleri, vadeli borç/alacaklar, tarihsiz bekleyen alacak/borçlar. Gecikmiş üstte.
// Gösterimdir; gerçek kayıt (kart ödemesi, ödeşme) girilince satır kendiliğinden kalkar.
export function Upcoming({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { openPreset } = useEntryDialog()
  const currency = membership.group.base_currency
  const unit = 10 ** exponentOf(currency)
  const now = today()

  const data = useQuery({
    queryKey: ['entries', membership.group.id, 'upcoming', membership.id],
    queryFn: async () => {
      const [cards, loans, plans, balances] = await Promise.all([
        supabase.from('card_due_status').select('account_id, name, due_date, statement_debt, paid_since').eq('member_id', membership.id),
        supabase.from('loan_due_status').select('account_id, name, installment_count, paid_count, next_due_date, due_amount, current_debt')
          .eq('member_id', membership.id),
        supabase.from('plans').select('id, contact_id, due_date, contact:contacts(name)')
          .eq('member_id', membership.id).eq('status', 'open').eq('kind', 'debt_due').order('due_date')
          .overrideTypes<PlanRow[]>(),
        supabase.from('contact_balances').select('contact_id, net_base_amount, contact:contacts(name)')
          .eq('member_id', membership.id).overrideTypes<Balance[]>(),
      ])
      for (const r of [cards, loans, plans, balances]) if (r.error) throw r.error
      return { cards: cards.data as CardDue[], loans: loans.data as LoanDue[], plans: plans.data!, balances: balances.data! }
    },
  })

  const dismiss = useMutation({
    mutationFn: (v: { id: string; due?: string }) =>
      callFunction('plan-update', v.due ? { id: v.id, action: 'postpone', due_date: v.due } : { id: v.id, action: 'dismiss' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['entries', membership.group.id, 'upcoming'] }),
  })

  const money = (minor: number) => formatMinor(minor, currency, i18n.language)
  const items: Item[] = []
  if (data.data) {
    const { cards, loans, plans, balances } = data.data
    for (const l of loans) {
      if (Number(l.current_debt) <= 0 || l.paid_count >= l.installment_count) continue
      items.push({ key: `loan-${l.account_id}`, kind: 'loan', title: l.name,
        detail: t('entry.loan.installmentDue', { n: l.paid_count + 1, count: l.installment_count }),
        date: l.next_due_date, amount: Number(l.due_amount), cardId: l.account_id })
    }
    for (const c of cards) {
      const remaining = Number(c.statement_debt) - Number(c.paid_since)
      if (remaining > 0) {
        items.push({ key: `card-${c.account_id}`, kind: 'card', title: c.name, detail: t('upcoming.cardDue'),
          date: c.due_date, amount: remaining, cardId: c.account_id })
      }
    }
    const net = new Map<string, { name: string; net: number }>()
    for (const b of balances) {
      const cur = net.get(b.contact_id) ?? { name: b.contact?.name ?? '—', net: 0 }
      cur.net += Number(b.net_base_amount)
      net.set(b.contact_id, cur)
    }
    const planned = new Set<string>()
    for (const p of plans) {
      const n = net.get(p.contact_id)
      if (!n || n.net === 0 || planned.has(p.contact_id)) continue // ödeşildi: kapanmış sayılır
      planned.add(p.contact_id)
      items.push({ key: `plan-${p.id}`, kind: 'debt', title: n.name,
        detail: t(n.net > 0 ? 'upcoming.theyOwe' : 'upcoming.iOwe'), date: p.due_date, amount: Math.abs(n.net),
        contact: n.name, planId: p.id })
    }
    for (const [id, n] of net) {
      if (n.net === 0 || planned.has(id)) continue
      items.push({ key: `bal-${id}`, kind: 'debt', title: n.name, detail: t(n.net > 0 ? 'upcoming.theyOwe' : 'upcoming.iOwe'),
        date: null, amount: Math.abs(n.net), contact: n.name })
    }
    items.sort((a, b) => (a.date ?? '9999') .localeCompare(b.date ?? '9999') || a.title.localeCompare(b.title))
  }

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' })
  const decimal = (minor: number) => (minor / unit).toFixed(Math.log10(unit))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('upcoming.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {data.isLoading && <Skeleton className="h-12" />}
        {data.data && items.length === 0 && <p className="text-sm text-muted-foreground">{t('upcoming.empty')}</p>}
        <ul className="flex flex-col divide-y">
          {items.map((it) => {
            const overdue = !!it.date && it.date < now
            const Icon = it.kind === 'card' ? CreditCardIcon : it.kind === 'loan' ? LandmarkIcon : HandCoinsIcon
            return (
              <li key={it.key} className="flex flex-col gap-2 py-2">
                <div className="flex items-center gap-3">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {it.title}
                      {overdue && <Badge variant="destructive">{t('upcoming.overdue')}</Badge>}
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {it.date && <CalendarClockIcon className="size-3" aria-hidden />}
                      {[it.date ? dateFmt.format(new Date(`${it.date}T00:00:00`)) : null, it.detail].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span className={cn('shrink-0 text-sm font-medium tabular-nums', overdue && 'text-destructive')}>{money(it.amount)}</span>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {it.planId && (
                    <>
                      <Button size="xs" variant="ghost" disabled={dismiss.isPending}
                        onClick={() => dismiss.mutate({ id: it.planId!, due: addDays(it.date! < now ? now : it.date!, 7) })}>
                        {t('upcoming.postpone')}
                      </Button>
                      <Button size="xs" variant="ghost" disabled={dismiss.isPending} onClick={() => dismiss.mutate({ id: it.planId! })}>
                        {t('upcoming.dismiss')}
                      </Button>
                    </>
                  )}
                  <Button
                    size="xs" variant="outline"
                    onClick={() => it.kind !== 'debt'
                      ? openPreset({ kind: 'transfer', to: it.cardId, amount: decimal(it.amount) })
                      : openPreset({ kind: 'debt', mode: 'settle', contact: it.contact!, amount: decimal(it.amount) })}
                  >
                    {t(it.kind !== 'debt' ? 'upcoming.payCard' : 'upcoming.settle')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
        <FormError message={data.error ? errorMessage(t, data.error) : dismiss.error ? errorMessage(t, dismiss.error) : null} />
      </CardContent>
    </Card>
  )
}
