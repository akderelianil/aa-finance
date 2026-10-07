import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { PageShell, FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'

const today = () => new Date().toLocaleDateString('sv-SE')

type Row = {
  id: string; seq: number; due_date: string; amount: number
  plan: { description: string; installment_count: number }
}

export default function Installments({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const currency = membership.group.base_currency
  const [card, setCard] = useState('')
  const [total, setTotal] = useState('')
  const [count, setCount] = useState('3')
  const [firstDue, setFirstDue] = useState(today)
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')

  const cards = useQuery({
    queryKey: ['accounts', membership.group.id, 'cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts').select('id, name')
        .eq('owner_member_id', membership.id).eq('subtype', 'credit_card').is('archived_at', null).order('created_at')
      if (error) throw error
      return data
    },
  })

  const categories = useQuery({
    queryKey: ['categories', membership.group.id, 'expense'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts').select('name')
        .eq('group_id', membership.group.id).eq('type', 'expense').is('system_key', null).is('archived_at', null).order('name')
      if (error) throw error
      return data.map((r) => r.name)
    },
  })

  const upcoming = useQuery({
    queryKey: ['installments', membership.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installments')
        .select('id, seq, due_date, amount, plan:installment_plans!inner(description, installment_count, member_id)')
        .eq('plan.member_id', membership.id).is('payment_entry_id', null).order('due_date').limit(60)
        .overrideTypes<Row[]>()
      if (error) throw error
      return data
    },
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['installments', membership.id] })
    void queryClient.invalidateQueries({ queryKey: ['entries', membership.group.id] })
    void queryClient.invalidateQueries({ queryKey: ['accounts', membership.group.id] })
  }

  const create = useMutation({
    mutationFn: () =>
      callFunction('installment-create', {
        card_account_id: card || cards.data?.[0]?.id, total_amount: total.replace(',', '.'),
        installment_count: Number(count), first_due_date: firstDue, category_name: category,
        description: description || undefined,
      }),
    onSuccess: () => { setTotal(''); setDescription(''); refresh() },
  })

  const pay = useMutation({
    mutationFn: (id: string) => callFunction('installment-pay', { installment_id: id }),
    onSuccess: refresh,
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate()
  }

  return (
    <PageShell>
      <Button variant="ghost" className="self-start" nativeButton={false} render={<Link to="/" />}>{t('common.back')}</Button>
      <Card>
        <CardHeader><CardTitle>{t('installments.upcoming')}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {upcoming.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('installments.empty')}</p>}
          {upcoming.data?.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {i.plan.description || t('installments.purchase')} ({i.seq}/{i.plan.installment_count})
                </p>
                <p className="text-xs text-muted-foreground">{i.due_date}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span>{formatMinor(Number(i.amount), currency, i18n.language)}</span>
                <Button size="sm" variant="outline" disabled={pay.isPending} onClick={() => pay.mutate(i.id)}>
                  {t('installments.pay')}
                </Button>
              </div>
            </div>
          ))}
          <FormError message={pay.error ? errorMessage(t, pay.error) : upcoming.error ? errorMessage(t, upcoming.error) : null} />
        </CardContent>
      </Card>
      <Card>
        <form onSubmit={onSubmit}>
          <CardHeader><CardTitle>{t('installments.add')}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            {cards.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('installments.needCard')}</p>
            ) : (
              <>
                {(cards.data?.length ?? 0) > 1 && (
                  <select
                    aria-label={t('installments.card')} value={card} onChange={(e) => setCard(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  >
                    {cards.data!.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="i-total">{t('installments.total')} ({currency})</Label>
                  <Input
                    id="i-total" required inputMode="decimal" autoComplete="off" pattern="[0-9]+([.,][0-9]+)?"
                    value={total} onChange={(e) => setTotal(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="i-count">{t('installments.count')}</Label>
                  <Input id="i-count" required type="number" min={2} max={36} value={count} onChange={(e) => setCount(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="i-cat">{t('entry.category')}</Label>
                  <Input
                    id="i-cat" required maxLength={60} autoComplete="off" list="i-cat-list"
                    value={category} onChange={(e) => setCategory(e.target.value)}
                  />
                  <datalist id="i-cat-list">{categories.data?.map((n) => <option key={n} value={n} />)}</datalist>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="i-desc">{t('installments.description')}</Label>
                  <Input id="i-desc" maxLength={200} autoComplete="off" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="i-due">{t('installments.firstDue')}</Label>
                  <Input id="i-due" type="date" required value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
                </div>
                <FormError message={create.error ? errorMessage(t, create.error) : null} />
                <Button type="submit" disabled={create.isPending}>{t('entry.save')}</Button>
              </>
            )}
          </CardContent>
        </form>
      </Card>
    </PageShell>
  )
}
