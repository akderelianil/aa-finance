import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { AmountField, DateField, EntryFooter } from '@/components/entry/Fields'
import { OptionSelect } from '@/components/OptionSelect'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { decimal, today, useAfterSave, useMyAccounts } from '@/lib/entry'

type Dir = 'withdraw' | 'deposit'

// ATM: banka hesabı ↔ cüzdan. Cüzdan (nakit hesabı) sorulmaz; sunucu boş tarafı nakit sayar.
export function AtmForm({ membership, onDone }: { membership: Membership; onDone?: () => void }) {
  const { t } = useTranslation()
  const afterSave = useAfterSave()
  const currency = membership.group.base_currency
  const accounts = useMyAccounts(membership)
  const [dir, setDir] = useState<Dir>('withdraw')
  const [bank, setBank] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)

  const banks = (accounts.data ?? []).filter((a) => a.subtype === 'bank' && a.currency === currency)
  // Tek banka hesabı varsa seçili gelir.
  const bankId = bank || (banks.length === 1 ? banks[0].id : '')

  const save = useMutation({
    mutationFn: () => callFunction<{ entry_id: string }>('transfer-create', {
      ...(dir === 'withdraw' ? { from_account_id: bankId } : { to_account_id: bankId }),
      amount: decimal(amount), date,
    }),
    onSuccess: (r) => { afterSave(r.entry_id); onDone?.() },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <FieldGroup>
        <ToggleGroup
          value={[dir]} spacing={2} className="grid w-full grid-cols-2" aria-label={t('entry.kind.atm')}
          onValueChange={(v) => { if (v[0]) setDir(v[0] as Dir) }}
        >
          {(['withdraw', 'deposit'] as const).map((d) => (
            <ToggleGroupItem key={d} value={d} variant="outline" size="sm">{t(`entry.atm.${d}`)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <AmountField value={amount} onChange={setAmount} currency={currency} />
        <Field>
          <FieldLabel>{t('entry.atm.bank')}</FieldLabel>
          <OptionSelect
            value={bankId} onChange={setBank} options={banks.map((a) => ({ value: a.id, label: a.name }))}
            placeholder={t('entry.atm.bank')} label={t('entry.atm.bank')} disabled={banks.length === 0}
          />
          {accounts.data && banks.length === 0 && <FieldDescription>{t('entry.atm.noBank')}</FieldDescription>}
        </Field>
        <DateField value={date} onChange={setDate} />
        <EntryFooter error={save.error} pending={save.isPending} disabled={!bankId} onCancel={onDone} />
      </FieldGroup>
    </form>
  )
}
