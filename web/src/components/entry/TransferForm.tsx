import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { AmountField, DateField, EntryFooter } from '@/components/entry/Fields'
import { OptionSelect } from '@/components/OptionSelect'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { callFunction } from '@/lib/api'
import { AMOUNT, decimal, expectedReturn, today, useAfterSave, useMyAccounts, type EntryPreset } from '@/lib/entry'
import { exponentOf, formatMinor } from '@/lib/money'

const MOVABLE = ['cash', 'bank', 'credit_card', 'loan', 'other']
const NEW_DEPOSIT = '__deposit'

// Kendi hesapların arasında para: hedef kredi kartıysa bu kart ödemesidir.
// Hedef "Yeni vadeli hesap" ise vadeli açılır (anapara + yıllık oran + gün; beklenen getiri gösterilir).
export function TransferForm({ membership, preset, onDone }: {
  membership: Membership
  preset?: Extract<EntryPreset, { kind: 'transfer' }>
  onDone?: () => void
}) {
  const { t, i18n } = useTranslation()
  const afterSave = useAfterSave()
  const currency = membership.group.base_currency
  const accounts = useMyAccounts(membership)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(preset?.to ?? '')
  const [amount, setAmount] = useState(preset?.amount ?? '')
  const [date, setDate] = useState(today)
  const [rate, setRate] = useState('')
  const [days, setDays] = useState('32')
  const [withholding, setWithholding] = useState('')

  const options = (accounts.data ?? [])
    .filter((a) => a.currency === currency && MOVABLE.includes(a.subtype ?? 'other'))
    .map((a) => ({ value: a.id, label: a.name }))
  const toCard = accounts.data?.find((a) => a.id === to)?.subtype === 'credit_card'
  // Yaklaşanlar'dan açıldıysa ve tek banka hesabı varsa kaynak hazır gelir.
  const banks = (accounts.data ?? []).filter((a) => a.subtype === 'bank' && a.currency === currency)
  const fromId = from || (preset && banks.length === 1 ? banks[0].id : '')
  const deposit = to === NEW_DEPOSIT
  const unit = 10 ** exponentOf(currency)
  const expected = expectedReturn(Math.round(Number(decimal(amount)) * unit), Number(decimal(rate)), Number(days), Number(decimal(withholding) || 0))

  const save = useMutation({
    mutationFn: () => deposit
      ? callFunction<{ entry_id: string }>('deposit-open', {
          from_account_id: fromId, amount: decimal(amount), annual_rate: decimal(rate), days: Number(days),
          withholding_rate: withholding ? decimal(withholding) : undefined, date,
        })
      : callFunction<{ entry_id: string }>('transfer-create', { from_account_id: fromId, to_account_id: to, amount: decimal(amount), date }),
    onSuccess: (r) => { afterSave(r.entry_id); onDone?.() },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <FieldGroup>
        <AmountField value={amount} onChange={setAmount} currency={currency} />
        <Field>
          <FieldLabel>{t('accounts.from')}</FieldLabel>
          <OptionSelect value={fromId} onChange={setFrom} options={options.filter((o) => o.value !== to)} placeholder={t('accounts.from')} label={t('accounts.from')} />
        </Field>
        <Field>
          <FieldLabel>{t('accounts.to')}</FieldLabel>
          <OptionSelect
            value={to} onChange={setTo} placeholder={t('accounts.to')} label={t('accounts.to')}
            options={[...options.filter((o) => o.value !== fromId), { value: NEW_DEPOSIT, label: t('entry.deposit.new') }]}
          />
          {toCard && <FieldDescription>{t('entry.cardPayment')}</FieldDescription>}
        </Field>
        {deposit && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel htmlFor="dep-rate">{t('entry.deposit.rate')}</FieldLabel>
                <Input id="dep-rate" required inputMode="decimal" autoComplete="off" pattern={AMOUNT} value={rate} onChange={(e) => setRate(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="dep-days">{t('entry.deposit.days')}</FieldLabel>
                <Input id="dep-days" required type="number" min={1} max={3660} value={days} onChange={(e) => setDays(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="dep-wh">{t('entry.deposit.withholding')}</FieldLabel>
                <Input id="dep-wh" inputMode="decimal" autoComplete="off" pattern={AMOUNT} placeholder="0" value={withholding} onChange={(e) => setWithholding(e.target.value)} />
              </Field>
            </div>
            {expected > 0 && (
              <FieldDescription>{t('entry.deposit.expected', { amount: formatMinor(expected, currency, i18n.language) })}</FieldDescription>
            )}
          </>
        )}
        <DateField value={date} onChange={setDate} />
        <EntryFooter error={save.error} pending={save.isPending} disabled={!fromId || !to} onCancel={onDone} />
      </FieldGroup>
    </form>
  )
}
