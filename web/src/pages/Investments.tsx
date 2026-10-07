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

const KINDS = ['crypto', 'commodity', 'stock', 'fund', 'bond'] as const
const today = () => new Date().toLocaleDateString('sv-SE')

type Instrument = { id: string; symbol: string; name: string; kind: string; currency: string }
type Holding = { instrument: Instrument; quantity: string; book: number }

export default function Investments({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const groupId = membership.group.id
  const baseCurrency = membership.group.base_currency
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [instId, setInstId] = useState('')
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<(typeof KINDS)[number]>('stock')
  const [currency, setCurrency] = useState(baseCurrency)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [fee, setFee] = useState('')
  const [rate, setRate] = useState('')
  const [newPrice, setNewPrice] = useState<{ id: string; value: string } | null>(null)

  const instruments = useQuery({
    queryKey: ['instruments', groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from('instruments').select('id, symbol, name, kind, currency').eq('group_id', groupId).order('symbol')
      if (error) throw error
      return data as Instrument[]
    },
  })

  const currencies = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('currencies').select('code').order('code')
      if (error) throw error
      return data.map((r) => r.code as string)
    },
  })

  const holdings = useQuery({
    queryKey: ['holdings', membership.id],
    queryFn: async (): Promise<Holding[]> => {
      const { data: accs, error } = await supabase
        .from('accounts').select('id, instrument_id').eq('owner_member_id', membership.id).not('instrument_id', 'is', null)
      if (error) throw error
      const ids = accs.map((a) => a.id as string)
      if (ids.length === 0) return []
      const [{ data: hold }, { data: bal }, { data: inst }] = await Promise.all([
        supabase.from('investment_holdings').select('account_id, quantity').in('account_id', ids),
        supabase.from('account_balances').select('account_id, net_amount').in('account_id', ids),
        supabase.from('instruments').select('id, symbol, name, kind, currency').in('id', accs.map((a) => a.instrument_id as string)),
      ])
      return accs.flatMap((a) => {
        const instrument = inst?.find((i) => i.id === a.instrument_id) as Instrument | undefined
        const q = hold?.find((h) => h.account_id === a.id)?.quantity
        if (!instrument || !q || Number(q) <= 0) return []
        return [{ instrument, quantity: String(q), book: Number(bal?.find((b) => b.account_id === a.id)?.net_amount ?? 0) }]
      })
    },
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['holdings', membership.id] })
    void queryClient.invalidateQueries({ queryKey: ['instruments', groupId] })
    void queryClient.invalidateQueries({ queryKey: ['entries', groupId] })
    void queryClient.invalidateQueries({ queryKey: ['accounts', groupId] })
  }

  const selected = instruments.data?.find((i) => i.id === instId)
  const creating = !instId
  const instCurrency = creating ? currency : selected?.currency ?? baseCurrency

  const trade = useMutation({
    mutationFn: () =>
      callFunction('investment-trade', {
        side,
        ...(creating ? { instrument: { kind, symbol, name: name || undefined, currency } } : { instrument_id: instId }),
        quantity: qty.replace(',', '.'), price: price.replace(',', '.'),
        fee: fee.replace(',', '.') || undefined,
        rate: instCurrency !== baseCurrency ? rate.replace(',', '.') || undefined : undefined,
        date: today(),
      }),
    onSuccess: () => { setQty(''); setPrice(''); setFee(''); setRate(''); setSymbol(''); setName(''); refresh() },
  })

  const revalue = useMutation({
    mutationFn: (v: { id: string; value: string }) =>
      callFunction('investment-revalue', { instrument_id: v.id, price: v.value.replace(',', '.'), date: today() }),
    onSuccess: () => { setNewPrice(null); refresh() },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    trade.mutate()
  }

  const num = (id: string, label: string, value: string, set: (v: string) => void, required = true) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required={required} inputMode="decimal" autoComplete="off" pattern="[0-9]+([.,][0-9]+)?" value={value} onChange={(e) => set(e.target.value)} />
    </div>
  )

  return (
    <PageShell>
      <Button variant="ghost" className="self-start" nativeButton={false} render={<Link to="/ayarlar" />}>{t('common.back')}</Button>
      <Card>
        <CardHeader><CardTitle>{t('investments.holdings')}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {holdings.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('investments.empty')}</p>}
          {holdings.data?.map((h) => (
            <div key={h.instrument.id} className="flex flex-col gap-2 border-b pb-2 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{h.instrument.symbol} · {h.quantity}</p>
                  <p className="truncate text-xs text-muted-foreground">{h.instrument.name}</p>
                </div>
                <span>{formatMinor(h.book, h.instrument.currency, i18n.language)}</span>
              </div>
              {newPrice?.id === h.instrument.id ? (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); revalue.mutate(newPrice) }}>
                  <Input
                    required autoFocus inputMode="decimal" autoComplete="off" pattern="[0-9]+([.,][0-9]+)?"
                    placeholder={`${t('investments.price')} (${h.instrument.currency})`}
                    value={newPrice.value} onChange={(e) => setNewPrice({ id: h.instrument.id, value: e.target.value })}
                  />
                  <Button size="sm" type="submit" disabled={revalue.isPending}>{t('entry.save')}</Button>
                </form>
              ) : (
                <Button size="sm" variant="ghost" className="self-start" onClick={() => setNewPrice({ id: h.instrument.id, value: '' })}>
                  {t('investments.updatePrice')}
                </Button>
              )}
            </div>
          ))}
          <FormError message={revalue.error ? errorMessage(t, revalue.error) : holdings.error ? errorMessage(t, holdings.error) : null} />
        </CardContent>
      </Card>
      <Card>
        <form onSubmit={onSubmit}>
          <CardHeader><CardTitle>{t('investments.trade')}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 gap-2">
              {(['buy', 'sell'] as const).map((s) => (
                <Button key={s} type="button" variant={side === s ? 'default' : 'outline'} onClick={() => setSide(s)}>
                  {t(`investments.side.${s}`)}
                </Button>
              ))}
            </div>
            <select
              aria-label={t('investments.instrument')} value={instId} onChange={(e) => setInstId(e.target.value)}
              className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">{t('investments.newInstrument')}</option>
              {instruments.data?.map((i) => <option key={i.id} value={i.id}>{i.symbol} — {i.name}</option>)}
            </select>
            {creating && (
              <>
                <Input required maxLength={30} placeholder={t('investments.symbol')} value={symbol} onChange={(e) => setSymbol(e.target.value)} />
                <Input maxLength={100} placeholder={t('investments.name')} value={name} onChange={(e) => setName(e.target.value)} />
                <select
                  aria-label={t('investments.kind')} value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}
                  className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {KINDS.map((k) => <option key={k} value={k}>{t(`investments.kinds.${k}`)}</option>)}
                </select>
                <select
                  aria-label={t('accounts.currency')} value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {currencies.data?.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </>
            )}
            {num('t-qty', t('investments.quantity'), qty, setQty)}
            {num('t-price', `${t('investments.price')} (${instCurrency})`, price, setPrice)}
            {num('t-fee', t('investments.fee'), fee, setFee, false)}
            {instCurrency !== baseCurrency && (
              <Input
                inputMode="decimal" autoComplete="off" pattern="[0-9]+([.,][0-9]+)?"
                placeholder={t('accounts.rateHint', { from: instCurrency, to: baseCurrency })}
                value={rate} onChange={(e) => setRate(e.target.value)}
              />
            )}
            <FormError message={trade.error ? errorMessage(t, trade.error) : null} />
            <Button type="submit" disabled={trade.isPending}>{t('entry.save')}</Button>
          </CardContent>
        </form>
      </Card>
    </PageShell>
  )
}
