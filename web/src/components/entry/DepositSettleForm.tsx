import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { DateChip, EntryFooter } from '@/components/entry/Fields'
import { OptionSelect } from '@/components/OptionSelect'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { AMOUNT, decimal, expectedReturn, today, useAfterSave, useMyAccounts } from '@/lib/entry'
import { exponentOf, formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'

type Outcome = 'return' | 'renew'
type RenewMode = 'all' | 'principal'
type Settings = {
  principal: number; annual_rate: number; days: number; withholding_rate: number; maturity_date: string
  return_account_id: string | null; account: { name: string } | null
}

// Vade sonu / erken bozma: kullanıcı bankada ne olduğunu seçer; uygulama varsaymaz.
// Varsayılanlar beklenen tutardan gelir; gerçek tutar farklıysa fark gelir ya da gider olur.
export function DepositSettleForm({ membership, accountId, onDone }: { membership: Membership; accountId: string; onDone?: () => void }) {
  const { t, i18n } = useTranslation()
  const afterSave = useAfterSave()
  const currency = membership.group.base_currency
  const unit = 10 ** exponentOf(currency)
  const accounts = useMyAccounts(membership)
  const [outcome, setOutcome] = useState<Outcome>('renew')
  const [renewMode, setRenewMode] = useState<RenewMode>('all')
  const [received, setReceived] = useState<string | null>(null)
  const [income, setIncome] = useState<string | null>(null)
  const [withdrawn, setWithdrawn] = useState('')
  const [more, setMore] = useState(false)
  const [rate, setRate] = useState('')
  const [days, setDays] = useState<string | null>(null)
  const [target, setTarget] = useState('')
  const [date, setDate] = useState(today)

  const settings = useQuery({
    queryKey: ['deposit', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deposit_settings')
        .select('principal, annual_rate, days, withholding_rate, maturity_date, return_account_id, account:accounts!deposit_settings_account_id_fkey(name)')
        .eq('account_id', accountId).single().overrideTypes<Settings, { merge: false }>()
      if (error) throw error
      return data
    },
  })

  const s = settings.data
  const matured = !!s && s.maturity_date <= date
  const expected = s ? expectedReturn(Number(s.principal), Number(s.annual_rate), s.days, Number(s.withholding_rate)) : 0
  const asDecimal = (minor: number) => (minor / unit).toFixed(Math.round(Math.log10(unit)))
  // Erken bozmada getiri beklenmez: varsayılan yalnız anapara.
  const receivedValue = received ?? (s ? asDecimal(Number(s.principal) + (matured ? expected : 0)) : '')
  const incomeValue = income ?? asDecimal(expected)
  const banks = (accounts.data ?? []).filter((a) => a.currency === currency && (a.subtype === 'bank' || a.subtype === 'cash'))
  const targetId = target || s?.return_account_id || ''

  const save = useMutation({
    mutationFn: () => callFunction<{ entry_id: string | null }>('deposit-settle', outcome === 'return'
      ? { account_id: accountId, outcome, received: decimal(receivedValue), target_account_id: targetId || undefined, date }
      : {
          account_id: accountId, outcome, income: decimal(incomeValue), annual_rate: decimal(rate), days: days ?? s?.days,
          withdrawn: renewMode === 'principal' ? decimal(incomeValue) : withdrawn ? decimal(withdrawn) : undefined,
          target_account_id: targetId || undefined, date,
        }),
    onSuccess: (r) => { if (r.entry_id) afterSave(r.entry_id); onDone?.() },
  })

  if (!s) return <Skeleton className="h-40" />
  const money = (minor: number) => formatMinor(minor, currency, i18n.language)

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <FieldGroup>
        <div className="rounded-lg border p-3 text-sm">
          <p className="font-medium">{s.account?.name}</p>
          <p className="text-muted-foreground">
            {t('entry.deposit.info', { principal: money(Number(s.principal)), rate: s.annual_rate, date: s.maturity_date, expected: money(expected) })}
          </p>
        </div>
        <ToggleGroup
          value={[outcome]} spacing={2} className="grid w-full grid-cols-2" aria-label={t('entry.deposit.what')}
          onValueChange={(v) => { if (v[0]) setOutcome(v[0] as Outcome) }}
        >
          <ToggleGroupItem value="renew" variant="outline" size="sm">{t('entry.deposit.renewed')}</ToggleGroupItem>
          <ToggleGroupItem value="return" variant="outline" size="sm">{t(matured ? 'entry.deposit.returned' : 'entry.deposit.broken')}</ToggleGroupItem>
        </ToggleGroup>
        {outcome === 'return' && (
          <Field>
            <FieldLabel htmlFor="dep-received">{t('entry.deposit.received')}</FieldLabel>
            <Input id="dep-received" required inputMode="decimal" autoComplete="off" pattern={AMOUNT}
              value={receivedValue} onChange={(e) => setReceived(e.target.value)} />
            <FieldDescription>{t('entry.deposit.receivedHint')}</FieldDescription>
          </Field>
        )}
        {outcome === 'renew' && (
          <>
            <Field>
              <FieldLabel htmlFor="dep-income">{t('entry.deposit.income')}</FieldLabel>
              <Input id="dep-income" inputMode="decimal" autoComplete="off" pattern={AMOUNT}
                value={incomeValue} onChange={(e) => setIncome(e.target.value)} />
            </Field>
            <ToggleGroup
              value={[renewMode]} spacing={2} className="grid w-full grid-cols-2" aria-label={t('entry.deposit.renewWhat')}
              onValueChange={(v) => { if (v[0]) setRenewMode(v[0] as RenewMode) }}
            >
              <ToggleGroupItem value="all" variant="outline" size="sm">{t('entry.deposit.renewAll')}</ToggleGroupItem>
              <ToggleGroupItem value="principal" variant="outline" size="sm">{t('entry.deposit.renewPrincipal')}</ToggleGroupItem>
            </ToggleGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="dep-rate">{t('entry.deposit.newRate')}</FieldLabel>
                <Input id="dep-rate" required inputMode="decimal" autoComplete="off" pattern={AMOUNT} placeholder={String(s.annual_rate)}
                  value={rate} onChange={(e) => setRate(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="dep-days">{t('entry.deposit.days')}</FieldLabel>
                <Input id="dep-days" required type="number" min={1} max={3660} value={days ?? String(s.days)} onChange={(e) => setDays(e.target.value)} />
              </Field>
            </div>
            <FieldDescription>{t('entry.deposit.newRateHint', { rate: s.annual_rate })}</FieldDescription>
            {!more && renewMode === 'all' && (
              <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => setMore(true)}>{t('entry.deposit.partial')}</Button>
            )}
            {more && renewMode === 'all' && (
              <Field>
                <FieldLabel htmlFor="dep-withdrawn">{t('entry.deposit.withdrawn')}</FieldLabel>
                <Input id="dep-withdrawn" inputMode="decimal" autoComplete="off" pattern={AMOUNT} value={withdrawn} onChange={(e) => setWithdrawn(e.target.value)} />
              </Field>
            )}
          </>
        )}
        {(outcome === 'return' || renewMode === 'principal' || withdrawn) && banks.length > 0 && (
          <Field>
            <FieldLabel>{t('entry.deposit.target')}</FieldLabel>
            <OptionSelect value={targetId} onChange={setTarget} options={banks.map((b) => ({ value: b.id, label: b.name }))}
              placeholder={t('entry.deposit.target')} label={t('entry.deposit.target')} />
          </Field>
        )}
        <DateChip value={date} onChange={setDate} />
        <EntryFooter error={save.error} pending={save.isPending} />
      </FieldGroup>
    </form>
  )
}
