import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { OptionSelect } from '@/components/OptionSelect'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { EntryRow } from '@/components/RecentEntries'
import { useAfterSave } from '@/lib/entry'

const today = () => new Date().toLocaleDateString('sv-SE')

// Gider / gelir formu. editing verilirse o kaydı düzenler (üst bileşen key={editing.id} ile yeniden kurar).
export function ExpenseIncomeForm({
  membership, kind, editing, onDone,
}: { membership: Membership; kind: 'expense' | 'income'; editing?: EntryRow | null; onDone?: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const afterSave = useAfterSave()
  const groupId = membership.group.id
  const [amount, setAmount] = useState(editing?.amount ?? '')
  const [date, setDate] = useState(editing?.entry_date ?? today())
  const [contact, setContact] = useState(editing?.contact ?? '')
  const [category, setCategory] = useState(editing?.category ?? '')
  const [accountId, setAccountId] = useState('')
  const [otherCurrency, setOtherCurrency] = useState('')
  const [rate, setRate] = useState('')
  const [baseAmount, setBaseAmount] = useState('')

  const categories = useQuery({
    queryKey: ['categories', groupId, kind],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts').select('name')
        .eq('group_id', groupId).eq('type', kind).is('system_key', null).is('archived_at', null)
        .order('name')
      if (error) throw error
      return data.map((r) => r.name)
    },
  })

  const accounts = useQuery({
    queryKey: ['accounts', groupId, 'mine'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts').select('id, name, currency')
        .eq('owner_member_id', membership.id).in('type', ['asset', 'liability']).is('system_key', null)
        .is('archived_at', null).order('created_at')
      if (error) throw error
      return data
    },
  })

  const contacts = useQuery({
    queryKey: ['contacts', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts').select('name').eq('group_id', groupId).is('archived_at', null).order('name')
      if (error) throw error
      return data.map((r) => r.name)
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

  const baseCurrency = membership.group.base_currency
  const selected = accounts.data?.find((a) => a.id === accountId)
  const foreignAccount = !!selected && selected.currency !== baseCurrency
  const effectiveCurrency = foreignAccount ? selected.currency : otherCurrency || baseCurrency

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        amount: amount.replace(',', '.'),
        date,
        category_name: category,
        contact_name: contact,
      }
      return editing
        ? callFunction<{ entry_id?: string }>('transaction-update', { entry_id: editing.id, ...payload })
        : callFunction<{ entry_id?: string }>('transaction-create', {
            kind, ...payload, contact_name: contact || undefined, account_id: accountId || undefined,
            currency: !foreignAccount && otherCurrency ? otherCurrency : undefined,
            rate: effectiveCurrency !== baseCurrency ? rate.replace(',', '.') || undefined : undefined,
            base_amount: !foreignAccount && otherCurrency ? baseAmount.replace(',', '.') || undefined : undefined,
          })
    },
    onSuccess: (r) => {
      if (!editing && r.entry_id) afterSave(r.entry_id)
      else void queryClient.invalidateQueries({ queryKey: ['entries', groupId] })
      onDone?.()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const AMOUNT = '[0-9]+([.,][0-9]+)?'

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="amount">{t('entry.amount')} ({effectiveCurrency})</FieldLabel>
          <Input
            id="amount" required autoFocus inputMode="decimal" autoComplete="off" placeholder="0,00"
            pattern={AMOUNT} value={amount} onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="category">{t('entry.category')}</FieldLabel>
          <Input
            id="category" required maxLength={60} autoComplete="off" list="category-list"
            value={category} onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="category-list">
            {categories.data?.map((n) => <option key={n} value={n} />)}
          </datalist>
        </Field>
        <Field>
          <FieldLabel htmlFor="contact">{t(`entry.contact.${kind}`)}</FieldLabel>
          <Input
            id="contact" maxLength={100} autoComplete="off" list="contact-list"
            value={contact} onChange={(e) => setContact(e.target.value)}
          />
          <datalist id="contact-list">
            {contacts.data?.map((n) => <option key={n} value={n} />)}
          </datalist>
        </Field>
        {!editing && !foreignAccount && (currencies.data?.length ?? 0) > 1 && (
          <Field>
            <FieldLabel htmlFor="currency">{t('accounts.currency')}</FieldLabel>
            <OptionSelect
              id="currency" value={otherCurrency} onChange={setOtherCurrency}
              options={[
                { value: '', label: t('entry.sameCurrency', { currency: baseCurrency }) },
                ...currencies.data!.filter((c) => c !== baseCurrency).map((c) => ({ value: c, label: c })),
              ]}
            />
          </Field>
        )}
        {!editing && effectiveCurrency !== baseCurrency && (
          <>
            <Field>
              <Input
                aria-label={t('accounts.rateHint', { from: effectiveCurrency, to: baseCurrency })}
                inputMode="decimal" autoComplete="off" pattern={AMOUNT}
                placeholder={t('accounts.rateHint', { from: effectiveCurrency, to: baseCurrency })}
                value={rate} onChange={(e) => setRate(e.target.value)}
              />
            </Field>
            {!foreignAccount && (
              <Field>
                <Input
                  aria-label={t('entry.baseAmountHint', { currency: baseCurrency })}
                  inputMode="decimal" autoComplete="off" pattern={AMOUNT}
                  placeholder={t('entry.baseAmountHint', { currency: baseCurrency })}
                  value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)}
                />
              </Field>
            )}
          </>
        )}
        {!editing && (accounts.data?.length ?? 0) > 1 && (
          <Field>
            <FieldLabel htmlFor="account">{t('accounts.account')}</FieldLabel>
            {/* Boş = otomatik (nakit hesap) */}
            <OptionSelect
              id="account" value={accountId} onChange={setAccountId}
              options={[{ value: '', label: '—' }, ...accounts.data!.map((a) => ({ value: a.id, label: a.name }))]}
            />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="date">{t('entry.date')}</FieldLabel>
          <Input id="date" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <FormError message={save.error ? errorMessage(t, save.error) : null} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone}>{t('entry.cancel')}</Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t('entry.save')}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
