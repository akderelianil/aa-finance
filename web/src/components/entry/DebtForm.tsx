import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { AmountField, DateField, EntryFooter } from '@/components/entry/Fields'
import { OptionSelect } from '@/components/OptionSelect'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { decimal, today, useAfterSave, useMyAccounts, type EntryPreset } from '@/lib/entry'
import { formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'

type Mode = 'borrow' | 'lend' | 'settle'
type Payer = 'they' | 'me'
type BalanceRow = { net_base_amount: number; contact: { name: string } | null }

// Borç tek düğme: Aldım / Verdim / Ödeşme. Ödeşmede yön kişinin bakiyesinden gelir, değiştirilebilir.
export function DebtForm({ membership, preset, onDone }: {
  membership: Membership
  preset?: Extract<EntryPreset, { kind: 'debt' }>
  onDone?: () => void
}) {
  const { t, i18n } = useTranslation()
  const afterSave = useAfterSave()
  const currency = membership.group.base_currency
  const accounts = useMyAccounts(membership)
  const [mode, setMode] = useState<Mode>(preset?.mode ?? 'borrow')
  const [payer, setPayer] = useState<Payer | null>(null)
  const [contact, setContact] = useState(preset?.contact ?? '')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState(preset?.amount ?? '')
  const [date, setDate] = useState(today)
  const [due, setDue] = useState('')

  const contacts = useQuery({
    queryKey: ['contacts', membership.group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts').select('name').eq('group_id', membership.group.id).is('archived_at', null).order('name')
      if (error) throw error
      return data.map((r) => r.name)
    },
  })

  // Kişi adı → net (minor): + kişi bana borçlu, − ben ona borçluyum.
  const balances = useQuery({
    queryKey: ['contact-balances', membership.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_balances').select('net_base_amount, contact:contacts(name)')
        .eq('member_id', membership.id).overrideTypes<BalanceRow[]>()
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data) {
        const name = r.contact?.name ?? ''
        m.set(name, (m.get(name) ?? 0) + Number(r.net_base_amount))
      }
      return m
    },
  })

  const net = balances.data?.get(contact.trim()) ?? 0
  const effectivePayer: Payer = payer ?? (net < 0 ? 'me' : 'they')
  const action = mode === 'borrow' ? 'borrow' : mode === 'lend' ? 'lend' : effectivePayer === 'they' ? 'collect' : 'repay'

  const save = useMutation({
    mutationFn: () => callFunction<{ entry_id: string }>('debt-create', {
      action, contact_name: contact.trim(), account_id: accountId || undefined, amount: decimal(amount), date,
      due_date: mode !== 'settle' && due ? due : undefined,
    }),
    onSuccess: (r) => { afterSave(r.entry_id); onDone?.() },
  })

  const accountOptions = [
    { value: '', label: t('accounts.subtype.cash') },
    ...(accounts.data ?? [])
      .filter((a) => a.currency === currency && (a.subtype === 'bank' || a.subtype === 'credit_card'))
      .map((a) => ({ value: a.id, label: a.name })),
  ]

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <FieldGroup>
        <ToggleGroup
          value={[mode]} spacing={2} className="grid w-full grid-cols-3" aria-label={t('entry.kind.debt')}
          onValueChange={(v) => { if (v[0]) setMode(v[0] as Mode) }}
        >
          {(['borrow', 'lend', 'settle'] as const).map((m) => (
            <ToggleGroupItem key={m} value={m} variant="outline" size="sm">{t(`entry.debt.${m}`)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Field>
          <FieldLabel htmlFor="debt-contact">{t('entry.debt.who')}</FieldLabel>
          <Input
            id="debt-contact" required maxLength={100} autoComplete="off" list="debt-contact-list"
            value={contact} onChange={(e) => { setContact(e.target.value); setPayer(null) }}
          />
          <datalist id="debt-contact-list">
            {contacts.data?.map((n) => <option key={n} value={n} />)}
          </datalist>
          {mode === 'settle' && contact.trim() && balances.data && (
            <FieldDescription>
              {net === 0 ? t('entry.debt.even')
                : t(net > 0 ? 'entry.debt.theyOwe' : 'entry.debt.iOwe', { amount: formatMinor(Math.abs(net), currency, i18n.language) })}
            </FieldDescription>
          )}
        </Field>
        {mode === 'settle' && (
          <ToggleGroup
            value={[effectivePayer]} spacing={2} className="grid w-full grid-cols-2" aria-label={t('entry.debt.settle')}
            onValueChange={(v) => { if (v[0]) setPayer(v[0] as Payer) }}
          >
            {(['they', 'me'] as const).map((p) => (
              <ToggleGroupItem key={p} value={p} variant="outline" size="sm">
                {t(p === 'they' ? 'entry.debt.theyPaid' : 'entry.debt.iPaid')}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <AmountField value={amount} onChange={setAmount} currency={currency} />
        {accountOptions.length > 1 && (
          <Field>
            <FieldLabel>{t('entry.debt.accountOptional')}</FieldLabel>
            <OptionSelect value={accountId} onChange={setAccountId} options={accountOptions} label={t('entry.debt.accountOptional')} />
          </Field>
        )}
        <DateField value={date} onChange={setDate} />
        {mode !== 'settle' && (
          <Field>
            <FieldLabel htmlFor="debt-due">{t('entry.debt.due')}</FieldLabel>
            <Input id="debt-due" type="date" min={date} value={due} onChange={(e) => setDue(e.target.value)} />
            <FieldDescription>{t('entry.debt.dueHint')}</FieldDescription>
          </Field>
        )}
        <EntryFooter error={save.error} pending={save.isPending} onCancel={onDone} />
      </FieldGroup>
    </form>
  )
}
