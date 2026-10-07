import { useTranslation } from 'react-i18next'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { AMOUNT, today } from '@/lib/entry'
import { errorMessage } from '@/lib/errors'

export function AmountField({ value, onChange, currency }: { value: string; onChange: (v: string) => void; currency: string }) {
  const { t } = useTranslation()
  return (
    <Field>
      <FieldLabel htmlFor="amount">{t('entry.amount')} ({currency})</FieldLabel>
      <Input
        id="amount" required autoFocus inputMode="decimal" autoComplete="off" placeholder="0,00"
        pattern={AMOUNT} value={value} onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation()
  return (
    <Field>
      <FieldLabel htmlFor="date">{t('entry.date')}</FieldLabel>
      <Input id="date" type="date" required max={today()} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

export function EntryFooter({ error, pending, disabled, onCancel }: {
  error: unknown
  pending: boolean
  disabled?: boolean
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <FormError message={error ? errorMessage(t, error) : null} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>{t('entry.cancel')}</Button>
        <Button type="submit" disabled={pending || disabled}>
          {pending && <Spinner data-icon="inline-start" />}
          {t('entry.save')}
        </Button>
      </div>
    </>
  )
}
