import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { UserIcon } from 'lucide-react'
import {
  AmountField, DateChip, EntryFooter, MetaRow, MoreChip, OptionChips, TagsField,
} from '@/components/entry/Fields'
import { LoanForm } from '@/components/entry/LoanForm'
import { OptionSelect } from '@/components/OptionSelect'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Switch } from '@/components/ui/switch'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { chipClass, decimal, today, useAfterSave, useMyAccounts, type EntryPreset } from '@/lib/entry'
import { formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'

type Mode = 'borrow' | 'lend' | 'collect' | 'repay'
type BalanceRow = { net_base_amount: number; contact: { name: string } | null }

// Borç dört fiil: Borç aldım / Borç verdim / Tahsil ettim / Borcumu ödedim. Geri ödemede kişinin bakiyesi görünür.
// Görünen: tutar, kim, hesap · tarih çipleri. "Daha fazla": vade tarihi, etiket.
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
  const [contact, setContact] = useState(preset?.contact ?? '')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState(preset?.amount ?? '')
  const [date, setDate] = useState(today)
  const [due, setDue] = useState('')
  const [loan, setLoan] = useState(false) // Aldım → bankadan kredi
  const [more, setMore] = useState(false)
  const [dueOpen, setDueOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tags, setTags] = useState<string[]>([])

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
  const repayment = mode === 'collect' || mode === 'repay'

  const save = useMutation({
    mutationFn: () => callFunction<{ entry_id: string }>('debt-create', {
      action: mode, contact_name: contact.trim(), account_id: accountId || undefined, amount: decimal(amount), date,
      due_date: !repayment && dueOpen && due ? due : undefined, tags: tagsOpen ? tags : [],
    }),
    onSuccess: (r) => { afterSave(r.entry_id); onDone?.() },
  })

  const accountOptions = [
    { value: '', label: t('accounts.subtype.cash') },
    ...(accounts.data ?? [])
      .filter((a) => a.currency === currency && (a.subtype === 'bank' || a.subtype === 'credit_card'))
      .map((a) => ({ value: a.id, label: a.name })),
  ]

  const modes = (
    <>
      <ToggleGroup
        value={[mode]} spacing={2} className="grid w-full grid-cols-2" aria-label={t('entry.kind.debt')}
        onValueChange={(v) => { if (v[0]) setMode(v[0] as Mode) }}
      >
        {(['borrow', 'lend', 'collect', 'repay'] as const).map((m) => (
          <ToggleGroupItem key={m} value={m} variant="outline" size="sm">{t(`entry.debt.${m}`)}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      {mode === 'borrow' && (
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={loan} onCheckedChange={setLoan} />
          {t('entry.loan.toggle')}
        </label>
      )}
    </>
  )

  if (mode === 'borrow' && loan) {
    return (
      <div className="flex flex-col gap-4">
        {modes}
        <LoanForm membership={membership} lender={contact} onLenderChange={setContact} onDone={onDone} />
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="flex flex-col gap-4">
      {modes}
      <AmountField value={amount} onChange={setAmount} currency={currency} />
      <Field>
        <InputGroup>
          <InputGroupAddon><UserIcon /></InputGroupAddon>
          <InputGroupInput
            id="debt-contact" required maxLength={100} autoComplete="off" list="debt-contact-list"
            placeholder={t('entry.debt.who')} aria-label={t('entry.debt.who')}
            value={contact} onChange={(e) => setContact(e.target.value)}
          />
        </InputGroup>
        <datalist id="debt-contact-list">
          {contacts.data?.map((n) => <option key={n} value={n} />)}
        </datalist>
        {repayment && contact.trim() && balances.data && (
          <FieldDescription>
            {net === 0 ? t('entry.debt.even')
              : t(net > 0 ? 'entry.debt.theyOwe' : 'entry.debt.iOwe', { amount: formatMinor(Math.abs(net), currency, i18n.language) })}
          </FieldDescription>
        )}
      </Field>
      <MetaRow>
        {accountOptions.length > 1 && (
          <OptionSelect value={accountId} onChange={setAccountId} options={accountOptions} label={t('entry.debt.accountOptional')} className={chipClass} />
        )}
        <DateChip value={date} onChange={setDate} />
        <MoreChip open={more} onChange={setMore} />
      </MetaRow>
      {more && (
        <OptionChips>
          {!repayment && <Toggle variant="outline" size="sm" pressed={dueOpen} onPressedChange={setDueOpen}>{t('entry.debt.dueToggle')}</Toggle>}
          <Toggle variant="outline" size="sm" pressed={tagsOpen} onPressedChange={setTagsOpen}>{t('entry.tags.toggle')}</Toggle>
        </OptionChips>
      )}
      {!repayment && dueOpen && (
        <Field>
          <FieldLabel htmlFor="debt-due">{t('entry.debt.due')}</FieldLabel>
          <Input id="debt-due" type="date" min={date} value={due} onChange={(e) => setDue(e.target.value)} />
          <FieldDescription>{t('entry.debt.dueHint')}</FieldDescription>
        </Field>
      )}
      {tagsOpen && <TagsField value={tags} onChange={setTags} groupId={membership.group.id} />}
      <EntryFooter error={save.error} pending={save.isPending} />
    </form>
  )
}
