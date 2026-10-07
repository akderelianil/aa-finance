import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { FormError, PageShell } from '@/components/PageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { today } from '@/lib/entry'
import { errorMessage } from '@/lib/errors'
import { formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'

type Row = {
  id: string; seq: number; due_date: string; amount: number
  plan: { id: string; description: string; installment_count: number; card: { name: string } | null }
}

// Ekstre taksit takvimi: yalnız gösterim. Alışveriş tek gider olarak yazıldı; kart borcu kart ödemesiyle azalır.
// Yeni taksitli alışveriş Hızlı Kayıt → Gider → Taksitli ile girilir.
export default function Installments({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const currency = membership.group.base_currency
  const now = today()

  const upcoming = useQuery({
    queryKey: ['installments', membership.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installments')
        .select('id, seq, due_date, amount, plan:installment_plans!inner(id, description, installment_count, member_id, card:accounts(name))')
        .eq('plan.member_id', membership.id).gte('due_date', now).order('due_date').limit(120)
        .overrideTypes<Row[]>()
      if (error) throw error
      return data
    },
  })

  // Aya göre grupla: "Kasım 2026 · toplam".
  const monthFmt = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' })
  const months: { key: string; rows: Row[]; total: number }[] = []
  for (const r of upcoming.data ?? []) {
    const key = r.due_date.slice(0, 7)
    const g = months[months.length - 1]
    if (g && g.key === key) { g.rows.push(r); g.total += Number(r.amount) } else months.push({ key, rows: [r], total: Number(r.amount) })
  }

  return (
    <PageShell>
      <Button variant="ghost" className="self-start" nativeButton={false} render={<Link to="/ayarlar" />}>{t('common.back')}</Button>
      <Card>
        <CardHeader><CardTitle>{t('installments.upcoming')}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('installments.hint')}</p>
          {upcoming.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('installments.empty')}</p>}
          {months.map((m) => (
            <section key={m.key} className="flex flex-col gap-1">
              <h3 className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>{monthFmt.format(new Date(`${m.key}-01T00:00:00`))}</span>
                <span className="tabular-nums">{formatMinor(m.total, currency, i18n.language)}</span>
              </h3>
              <ul className="flex flex-col divide-y">
                {m.rows.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{i.plan.description || t('installments.purchase')}</p>
                      <p className="text-xs text-muted-foreground">{[i.plan.card?.name, i.due_date].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary">{i.seq}/{i.plan.installment_count}</Badge>
                      <span className="tabular-nums">{formatMinor(Number(i.amount), currency, i18n.language)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <FormError message={upcoming.error ? errorMessage(t, upcoming.error) : null} />
        </CardContent>
      </Card>
    </PageShell>
  )
}
