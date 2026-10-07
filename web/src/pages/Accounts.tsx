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

type AccountRow = { id: string; name: string; type: string; subtype: string | null; archived_at: string | null; currency: string | null }
const SUBTYPES = ['cash', 'bank', 'credit_card', 'loan'] as const

export default function Accounts({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const groupId = membership.group.id
  const currency = membership.group.base_currency
  const [name, setName] = useState('')
  const [subtype, setSubtype] = useState<(typeof SUBTYPES)[number]>('bank')
  const [opening, setOpening] = useState('')
  const [accCurrency, setAccCurrency] = useState(currency)
  const [accRate, setAccRate] = useState('')
  const [xFrom, setXFrom] = useState('')
  const [xTo, setXTo] = useState('')
  const [xFromAmt, setXFromAmt] = useState('')
  const [xToAmt, setXToAmt] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [tAmount, setTAmount] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)

  const accounts = useQuery({
    queryKey: ['accounts', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts').select('id, name, type, subtype, archived_at, owner_member_id, currency')
        .eq('group_id', groupId).is('system_key', null).order('name')
      if (error) throw error
      const { data: bal, error: be } = await supabase.from('account_balances').select('account_id, net_amount')
      if (be) throw be
      const net = new Map(bal.map((b) => [b.account_id as string, Number(b.net_amount)]))
      return { rows: data as (AccountRow & { owner_member_id: string | null })[], net }
    },
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['accounts', groupId] })
    void queryClient.invalidateQueries({ queryKey: ['categories', groupId] })
  }

  const create = useMutation({
    mutationFn: () =>
      callFunction('account-create', {
        name, subtype, currency: accCurrency, opening_balance: opening.replace(',', '.') || undefined,
        rate: accRate.replace(',', '.') || undefined,
      }),
    onSuccess: () => { setName(''); setOpening(''); setAccRate(''); refresh() },
  })

  const update = useMutation({
    mutationFn: (b: { account_id: string; name?: string; archived?: boolean }) => callFunction('account-update', b),
    onSuccess: () => { setRenaming(null); refresh() },
  })

  const currencies = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('currencies').select('code').order('code')
      if (error) throw error
      return data.map((r) => r.code as string)
    },
  })

  const exchange = useMutation({
    mutationFn: () =>
      callFunction('fx-exchange', {
        from_account_id: xFrom, to_account_id: xTo,
        from_amount: xFromAmt.replace(',', '.'), to_amount: xToAmt.replace(',', '.'),
      }),
    onSuccess: () => {
      setXFromAmt(''); setXToAmt('')
      refresh()
      void queryClient.invalidateQueries({ queryKey: ['entries', groupId] })
    },
  })

  const transfer = useMutation({
    mutationFn: () =>
      callFunction('transfer-create', { from_account_id: from, to_account_id: to, amount: tAmount.replace(',', '.') }),
    onSuccess: () => {
      setTAmount('')
      refresh()
      void queryClient.invalidateQueries({ queryKey: ['entries', groupId] })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate()
  }

  const mine = accounts.data?.rows.filter((a) => a.owner_member_id === membership.id && !a.archived_at) ?? []
  const categories = (type: string) =>
    accounts.data?.rows.filter((a) => a.type === type && !a.archived_at) ?? []

  function row(a: AccountRow, balance?: string) {
    return (
      <div key={a.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-b-0">
        {renaming?.id === a.id ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => { e.preventDefault(); update.mutate({ account_id: a.id, name: renaming.name }) }}
          >
            <Input value={renaming.name} maxLength={60} required onChange={(e) => setRenaming({ id: a.id, name: e.target.value })} />
            <Button size="sm" type="submit">{t('entry.save')}</Button>
          </form>
        ) : (
          <>
            <div className="min-w-0">
              <p className="truncate font-medium">{a.name}</p>
              {balance && <p className="text-xs text-muted-foreground">{balance}</p>}
            </div>
            <div className="flex shrink-0">
              <Button size="sm" variant="ghost" onClick={() => setRenaming({ id: a.id, name: a.name })}>{t('entry.edit')}</Button>
              <Button
                size="sm" variant="ghost" disabled={update.isPending}
                onClick={() => { if (window.confirm(t('accounts.confirmArchive'))) update.mutate({ account_id: a.id, archived: true }) }}
              >
                {t('accounts.archive')}
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <PageShell>
      <Button variant="ghost" className="self-start" nativeButton={false} render={<Link to="/" />}>{t('common.back')}</Button>
      <Card>
        <CardHeader><CardTitle>{t('accounts.title')}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {mine.map((a) => {
            const net = accounts.data?.net.get(a.id) ?? 0
            const shown = a.type === 'liability' ? -net : net
            return row(a, formatMinor(shown, a.currency ?? currency, i18n.language))
          })}
          <form onSubmit={onSubmit} className="flex flex-col gap-3 pt-2">
            <Label htmlFor="acc-name">{t('accounts.add')}</Label>
            <Input id="acc-name" required maxLength={60} placeholder={t('accounts.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
            <select
              aria-label={t('accounts.kind')} value={subtype}
              onChange={(e) => setSubtype(e.target.value as (typeof SUBTYPES)[number])}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {SUBTYPES.map((s) => <option key={s} value={s}>{t(`accounts.subtype.${s}`)}</option>)}
            </select>
            <select
              aria-label={t('accounts.currency')} value={accCurrency} onChange={(e) => setAccCurrency(e.target.value)}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {currencies.data?.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Input
              inputMode="decimal" autoComplete="off" pattern="[0-9]+([.,][0-9]+)?"
              placeholder={t(subtype === 'credit_card' || subtype === 'loan' ? 'accounts.openingDebt' : 'accounts.opening')}
              value={opening} onChange={(e) => setOpening(e.target.value)}
            />
            {accCurrency !== currency && opening && (
              <Input
                inputMode="decimal" autoComplete="off" pattern="[0-9]+([.,][0-9]+)?"
                placeholder={t('accounts.rateHint', { from: accCurrency, to: currency })}
                value={accRate} onChange={(e) => setAccRate(e.target.value)}
              />
            )}
            <FormError message={create.error ? errorMessage(t, create.error) : null} />
            <Button type="submit" disabled={create.isPending}>{t('accounts.addButton')}</Button>
          </form>
        </CardContent>
      </Card>
      {mine.length > 1 && (
        <Card>
          <form onSubmit={(e) => { e.preventDefault(); transfer.mutate() }}>
            <CardHeader><CardTitle>{t('accounts.transfer')}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 pt-4">
              {([['from', from, setFrom], ['to', to, setTo]] as const).map(([k, v, set]) => (
                <select
                  key={k} required aria-label={t(`accounts.${k}`)} value={v} onChange={(e) => set(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">{t(`accounts.${k}`)}</option>
                  {mine.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ))}
              <Input
                required inputMode="decimal" autoComplete="off" pattern="[0-9]+([.,][0-9]+)?"
                placeholder={`${t('entry.amount')} (${currency})`} value={tAmount} onChange={(e) => setTAmount(e.target.value)}
              />
              <FormError message={transfer.error ? errorMessage(t, transfer.error) : null} />
              <Button type="submit" disabled={transfer.isPending}>{t('accounts.transferButton')}</Button>
            </CardContent>
          </form>
        </Card>
      )}
      {mine.some((a) => a.currency !== currency) && mine.some((a) => a.currency === currency) && (
        <Card>
          <form onSubmit={(e) => { e.preventDefault(); exchange.mutate() }}>
            <CardHeader><CardTitle>{t('accounts.exchange')}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 pt-4">
              {([['from', xFrom, setXFrom, xFromAmt, setXFromAmt], ['to', xTo, setXTo, xToAmt, setXToAmt]] as const).map(
                ([k, v, set, amt, setAmt]) => (
                  <div key={k} className="flex gap-2">
                    <select
                      required aria-label={t(`accounts.${k}`)} value={v} onChange={(e) => set(e.target.value)}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    >
                      <option value="">{t(`accounts.${k}`)}</option>
                      {mine.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                    </select>
                    <Input
                      required inputMode="decimal" autoComplete="off" pattern="[0-9]+([.,][0-9]+)?" className="w-28"
                      placeholder={t('entry.amount')} value={amt} onChange={(e) => setAmt(e.target.value)}
                    />
                  </div>
                ),
              )}
              <FormError message={exchange.error ? errorMessage(t, exchange.error) : null} />
              <Button type="submit" disabled={exchange.isPending}>{t('accounts.exchangeButton')}</Button>
            </CardContent>
          </form>
        </Card>
      )}
      {(['expense', 'income'] as const).map((type) => (
        <Card key={type}>
          <CardHeader><CardTitle>{t(`accounts.categories.${type}`)}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {categories(type).length === 0 && <p className="text-sm text-muted-foreground">{t('accounts.noCategories')}</p>}
            {categories(type).map((a) => row(a))}
          </CardContent>
        </Card>
      ))}
      <FormError message={update.error ? errorMessage(t, update.error) : accounts.error ? errorMessage(t, accounts.error) : null} />
    </PageShell>
  )
}
