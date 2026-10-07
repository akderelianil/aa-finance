import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { AmountField, DateField, EntryFooter } from '@/components/entry/Fields'
import { OptionSelect } from '@/components/OptionSelect'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { callFunction } from '@/lib/api'
import { AMOUNT, decimal, today, useAfterSave, useMyAccounts } from '@/lib/entry'
import { exponentOf, formatMinor } from '@/lib/money'

// Banka kredisi: hesaba yatan tutar + taksit sayısı + taksit tutarı. Toplam geri ödeme kredi günü borç olur;
// anlaşılan tutar, toplam ve ilk taksit tarihi "daha fazla" altında (boşsa sunucu türetir).
export function LoanForm({ membership, lender, onLenderChange, onDone }: {
  membership: Membership
  lender: string
  onLenderChange: (v: string) => void
  onDone?: () => void
}) {
  const { t, i18n } = useTranslation()
  const afterSave = useAfterSave()
  const currency = membership.group.base_currency
  const accounts = useMyAccounts(membership)
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [count, setCount] = useState('12')
  const [installment, setInstallment] = useState('')
  const [more, setMore] = useState(false)
  const [principal, setPrincipal] = useState('')
  const [total, setTotal] = useState('')
  const [firstDue, setFirstDue] = useState('')
  const [date, setDate] = useState(today)

  const banks = (accounts.data ?? []).filter((a) => a.subtype === 'bank' && a.currency === currency)
  const target = banks.some((b) => b.id === accountId) ? accountId : banks.length === 1 ? banks[0].id : ''
  const unit = 10 ** exponentOf(currency)
  const toMinor = (v: string) => Math.round(Number(decimal(v)) * unit)
  const totalMinor = total ? toMinor(total) : toMinor(installment) * Number(count)
  const costMinor = totalMinor - toMinor(principal || amount)

  const save = useMutation({
    mutationFn: () => callFunction<{ entry_id: string }>('loan-create', {
      lender_name: lender.trim(), account_id: target || undefined, amount: decimal(amount),
      installment_count: Number(count), installment_amount: decimal(installment),
      principal: principal ? decimal(principal) : undefined, total_repayment: total ? decimal(total) : undefined,
      first_due_date: firstDue || undefined, date,
    }),
    onSuccess: (r) => { afterSave(r.entry_id); onDone?.() },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="loan-bank">{t('entry.loan.bank')}</FieldLabel>
          <Input id="loan-bank" required maxLength={100} autoComplete="off" value={lender} onChange={(e) => onLenderChange(e.target.value)} />
        </Field>
        <AmountField value={amount} onChange={setAmount} currency={currency} />
        {banks.length > 1 && (
          <Field>
            <FieldLabel>{t('entry.loan.account')}</FieldLabel>
            <OptionSelect value={target} onChange={setAccountId} options={banks.map((b) => ({ value: b.id, label: b.name }))}
              placeholder={t('entry.loan.account')} label={t('entry.loan.account')} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="loan-count">{t('entry.loan.count')}</FieldLabel>
            <Input id="loan-count" required type="number" min={1} max={120} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="loan-inst">{t('entry.loan.installment')}</FieldLabel>
            <Input id="loan-inst" required inputMode="decimal" autoComplete="off" pattern={AMOUNT} placeholder="0,00"
              value={installment} onChange={(e) => setInstallment(e.target.value)} />
          </Field>
        </div>
        {totalMinor > 0 && amount && (
          <FieldDescription>
            {t('entry.loan.summary', { total: formatMinor(totalMinor, currency, i18n.language), cost: formatMinor(Math.max(costMinor, 0), currency, i18n.language) })}
          </FieldDescription>
        )}
        {!more && <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => setMore(true)}>{t('entry.loan.more')}</Button>}
        {more && (
          <>
            <Field>
              <FieldLabel htmlFor="loan-principal">{t('entry.loan.principal')}</FieldLabel>
              <Input id="loan-principal" inputMode="decimal" autoComplete="off" pattern={AMOUNT} value={principal} onChange={(e) => setPrincipal(e.target.value)} />
              <FieldDescription>{t('entry.loan.principalHint')}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="loan-total">{t('entry.loan.total')}</FieldLabel>
              <Input id="loan-total" inputMode="decimal" autoComplete="off" pattern={AMOUNT} value={total} onChange={(e) => setTotal(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="loan-first">{t('entry.loan.firstDue')}</FieldLabel>
              <Input id="loan-first" type="date" min={date} value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
            </Field>
          </>
        )}
        <DateField value={date} onChange={setDate} />
        <EntryFooter error={save.error} pending={save.isPending} onCancel={onDone} />
      </FieldGroup>
    </form>
  )
}
