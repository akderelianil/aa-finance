import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { AmountField, DateField, EntryFooter } from '@/components/entry/Fields'
import { OptionSelect } from '@/components/OptionSelect'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { AMOUNT, decimal, today, useAfterSave, useMyAccounts } from '@/lib/entry'

type Dir = 'withdraw' | 'deposit'

// ATM: banka hesabı ↔ cüzdan. Cüzdan (nakit hesabı) sorulmaz; sunucu boş tarafı nakit sayar.
// Çekimde kredi kartı seçilirse nakit avanstır: komisyon (isteğe bağlı) gider olur, kart borcuna eklenir.
export function AtmForm({ membership, onDone }: { membership: Membership; onDone?: () => void }) {
  const { t } = useTranslation()
  const afterSave = useAfterSave()
  const currency = membership.group.base_currency
  const accounts = useMyAccounts(membership)
  const [dir, setDir] = useState<Dir>('withdraw')
  const [bank, setBank] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [fee, setFee] = useState('')

  const banks = (accounts.data ?? []).filter((a) => a.currency === currency
    && (a.subtype === 'bank' || (dir === 'withdraw' && a.subtype === 'credit_card')))
  // Tek seçenek varsa seçili gelir.
  const bankId = banks.some((b) => b.id === bank) ? bank : banks.length === 1 ? banks[0].id : ''
  const advance = dir === 'withdraw' && banks.find((b) => b.id === bankId)?.subtype === 'credit_card'

  const save = useMutation({
    mutationFn: () => callFunction<{ entry_id: string }>('transfer-create', {
      ...(dir === 'withdraw' ? { from_account_id: bankId } : { to_account_id: bankId }),
      amount: decimal(amount), date, fee: advance && fee ? decimal(fee) : undefined,
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
          {advance && <FieldDescription>{t('entry.atm.advanceHint')}</FieldDescription>}
        </Field>
        {advance && (
          <Field>
            <FieldLabel htmlFor="atm-fee">{t('entry.atm.fee')}</FieldLabel>
            <Input
              id="atm-fee" inputMode="decimal" autoComplete="off" placeholder="0,00" pattern={AMOUNT}
              value={fee} onChange={(e) => setFee(e.target.value)}
            />
          </Field>
        )}
        <DateField value={date} onChange={setDate} />
        <EntryFooter error={save.error} pending={save.isPending} disabled={!bankId} onCancel={onDone} />
      </FieldGroup>
    </form>
  )
}
