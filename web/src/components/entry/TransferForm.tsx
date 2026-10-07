import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { AmountField, DateField, EntryFooter } from '@/components/entry/Fields'
import { OptionSelect } from '@/components/OptionSelect'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { callFunction } from '@/lib/api'
import { decimal, today, useAfterSave, useMyAccounts } from '@/lib/entry'

const MOVABLE = ['cash', 'bank', 'credit_card', 'loan', 'other']

// Kendi hesapların arasında para: hedef kredi kartıysa bu kart ödemesidir.
export function TransferForm({ membership, onDone }: { membership: Membership; onDone?: () => void }) {
  const { t } = useTranslation()
  const afterSave = useAfterSave()
  const currency = membership.group.base_currency
  const accounts = useMyAccounts(membership)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)

  const options = (accounts.data ?? [])
    .filter((a) => a.currency === currency && MOVABLE.includes(a.subtype ?? 'other'))
    .map((a) => ({ value: a.id, label: a.name }))
  const toCard = accounts.data?.find((a) => a.id === to)?.subtype === 'credit_card'

  const save = useMutation({
    mutationFn: () => callFunction<{ entry_id: string }>('transfer-create', {
      from_account_id: from, to_account_id: to, amount: decimal(amount), date,
    }),
    onSuccess: (r) => { afterSave(r.entry_id); onDone?.() },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <FieldGroup>
        <AmountField value={amount} onChange={setAmount} currency={currency} />
        <Field>
          <FieldLabel>{t('accounts.from')}</FieldLabel>
          <OptionSelect value={from} onChange={setFrom} options={options.filter((o) => o.value !== to)} placeholder={t('accounts.from')} label={t('accounts.from')} />
        </Field>
        <Field>
          <FieldLabel>{t('accounts.to')}</FieldLabel>
          <OptionSelect value={to} onChange={setTo} options={options.filter((o) => o.value !== from)} placeholder={t('accounts.to')} label={t('accounts.to')} />
          {toCard && <FieldDescription>{t('entry.cardPayment')}</FieldDescription>}
        </Field>
        <DateField value={date} onChange={setDate} />
        <EntryFooter error={save.error} pending={save.isPending} disabled={!from || !to} onCancel={onDone} />
      </FieldGroup>
    </form>
  )
}
