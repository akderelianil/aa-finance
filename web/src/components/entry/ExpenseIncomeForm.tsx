import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { OptionSelect } from '@/components/OptionSelect'
import { SplitEditor } from '@/components/entry/SplitEditor'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Toggle } from '@/components/ui/toggle'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { EntryRow } from '@/components/RecentEntries'
import { splitPayload, useAfterSave, useMyAccounts, type SplitRow } from '@/lib/entry'
import { exponentOf, formatMinor } from '@/lib/money'

const today = () => new Date().toLocaleDateString('sv-SE')

// Gider / gelir formu. editing verilirse o kaydı düzenler (üst bileşen key={editing.id} ile yeniden kurar).
export function ExpenseIncomeForm({
  membership, kind, editing, onDone,
}: { membership: Membership; kind: 'expense' | 'income'; editing?: EntryRow | null; onDone?: () => void }) {
  const { t, i18n } = useTranslation()
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
  // Seçenekler (yalnız yeni kayıt): taksit (gider + kredi kartı), paylaştır (gider), not.
  const [installment, setInstallment] = useState(false)
  const [count, setCount] = useState('3')
  const [split, setSplit] = useState<SplitRow[] | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')

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

  const accounts = useMyAccounts(membership)

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
  const cards = (accounts.data ?? []).filter((a) => a.subtype === 'credit_card' && a.currency === baseCurrency)
  // Taksitte hesap yalnız kredi kartı; tek kart varsa seçili gelir.
  const cardId = installment ? (cards.some((c) => c.id === accountId) ? accountId : cards.length === 1 ? cards[0].id : '') : ''
  const accountOptions = installment ? cards : (accounts.data ?? [])
  const totalMinor = Math.round(Number(amount.replace(',', '.')) * 10 ** exponentOf(baseCurrency))
  const perInstallment = installment && Number(count) >= 2 && totalMinor > 0 ? Math.floor(totalMinor / Number(count)) : null
  const simple = !installment && !split // döviz yalnız sade giderde

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        amount: amount.replace(',', '.'),
        date,
        category_name: category,
        contact_name: contact,
      }
      const extras = { description: note.trim() || undefined, split: split ? splitPayload(split) : undefined }
      if (!editing && installment) {
        return callFunction<{ entry_id?: string }>('installment-create', {
          card_account_id: cardId, total_amount: payload.amount, installment_count: Number(count),
          category_name: category, contact_name: contact || undefined, date, ...extras,
        })
      }
      return editing
        ? callFunction<{ entry_id?: string }>('transaction-update', { entry_id: editing.id, ...payload })
        : callFunction<{ entry_id?: string }>('transaction-create', {
            kind, ...payload, ...extras, contact_name: contact || undefined, account_id: accountId || undefined,
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
        {!editing && simple && !foreignAccount && (currencies.data?.length ?? 0) > 1 && (
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
        {!editing && simple && effectiveCurrency !== baseCurrency && (
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
        {!editing && kind === 'expense' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('entry.options')}>
            <Toggle variant="outline" size="sm" pressed={installment} onPressedChange={setInstallment}>{t('entry.installment.toggle')}</Toggle>
            <Toggle variant="outline" size="sm" pressed={!!split} onPressedChange={(p) => setSplit(p ? [{ name: '', share: '' }] : null)}>
              {t('entry.split.toggle')}
            </Toggle>
            <Toggle variant="outline" size="sm" pressed={noteOpen} onPressedChange={setNoteOpen}>{t('entry.note')}</Toggle>
          </div>
        )}
        {!editing && kind === 'income' && !noteOpen && (
          <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => setNoteOpen(true)}>{t('entry.addNote')}</Button>
        )}
        {installment && (
          <Field>
            <FieldLabel htmlFor="count">{t('entry.installment.count')}</FieldLabel>
            <Input
              id="count" required type="number" min={2} max={36} inputMode="numeric" className="w-28"
              value={count} onChange={(e) => setCount(e.target.value)}
            />
            {perInstallment !== null && (
              <FieldDescription>{t('entry.installment.each', { amount: formatMinor(perInstallment, baseCurrency, i18n.language) })}</FieldDescription>
            )}
          </Field>
        )}
        {split && (
          <SplitEditor rows={split} onChange={setSplit} contacts={contacts.data ?? []} totalMinor={totalMinor} currency={baseCurrency} />
        )}
        {noteOpen && (
          <Field>
            <FieldLabel htmlFor="note">{t('entry.note')}</FieldLabel>
            <Input id="note" maxLength={200} autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
        {!editing && installment && (
          <Field>
            <FieldLabel htmlFor="account">{t('entry.installment.card')}</FieldLabel>
            <OptionSelect
              id="account" value={cardId} onChange={setAccountId} placeholder={t('entry.installment.card')}
              options={cards.map((a) => ({ value: a.id, label: a.name }))} disabled={cards.length === 0}
            />
            {accounts.data && cards.length === 0 && <FieldDescription>{t('entry.installment.noCard')}</FieldDescription>}
          </Field>
        )}
        {!editing && !installment && accountOptions.length > 1 && (
          <Field>
            <FieldLabel htmlFor="account">{t('accounts.account')}</FieldLabel>
            {/* Boş = otomatik (nakit hesap) */}
            <OptionSelect
              id="account" value={accountId} onChange={setAccountId}
              options={[{ value: '', label: t('accounts.subtype.cash') }, ...accountOptions.map((a) => ({ value: a.id, label: a.name }))]}
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
          <Button type="submit" disabled={save.isPending || (installment && !cardId)}>
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t('entry.save')}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
