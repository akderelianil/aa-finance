import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutGridIcon, StoreIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { OptionSelect } from '@/components/OptionSelect'
import {
  AmountField, DateChip, EntryFooter, MetaRow, MoreChip, OptionChips, TagsField,
} from '@/components/entry/Fields'
import { ItemsEditor } from '@/components/entry/ItemsEditor'
import { SplitEditor } from '@/components/entry/SplitEditor'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Toggle } from '@/components/ui/toggle'
import { callFunction } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { EntryRow } from '@/components/RecentEntries'
import { AMOUNT, chipClass, decimal, itemsPayload, splitPayload, today, useAfterSave, useMyAccounts, type ItemRow, type SplitRow } from '@/lib/entry'
import { exponentOf, formatMinor } from '@/lib/money'

// Gider / gelir formu. Görünen: tutar, kime, kategori, hesap · tarih çipleri.
// "Daha fazla": taksit, paylaştır, kalemler (gider), döviz, not, etiket.
// editing verilirse o kaydı düzenler (üst bileşen key={editing.id} ile yeniden kurar).
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
  // Düzenlemede ilk kategori satırı ana kategori, diğerleri kalemler.
  const [category, setCategory] = useState(editing?.parts[0]?.category ?? '')
  const [accountId, setAccountId] = useState('')
  const [fxOpen, setFxOpen] = useState(false)
  const [otherCurrency, setOtherCurrency] = useState('')
  const [rate, setRate] = useState('')
  const [baseAmount, setBaseAmount] = useState('')
  const [installment, setInstallment] = useState(false)
  const [count, setCount] = useState('3')
  const [split, setSplit] = useState<SplitRow[] | null>(null)
  const [items, setItems] = useState<ItemRow[] | null>(editing && editing.parts.length > 1 ? editing.parts.slice(1) : null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string[]>(editing?.tags ?? [])
  const [tagsOpen, setTagsOpen] = useState(!!editing?.tags.length)
  const [more, setMore] = useState(!!items || tagsOpen)

  const categories = useQuery({
    queryKey: ['categories', groupId, kind],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts').select('name, parent:parent_id(name)')
        .eq('group_id', groupId).eq('type', kind).is('system_key', null).eq('is_placeholder', false).is('archived_at', null)
        .order('name')
        .overrideTypes<{ name: string; parent: { name: string } | null }[]>()
      if (error) throw error
      return data
    },
  })

  const accounts = useMyAccounts(membership)

  // Rehber: isim → markanın varsayılan kategorisi (kategori kendiliğinden gelir, kullanıcı değiştirebilir).
  const directory = useQuery({
    queryKey: ['contacts', groupId, 'with-category'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts').select('name, default_category:accounts(name, type)')
        .eq('group_id', groupId).is('archived_at', null).order('name')
        .overrideTypes<{ name: string; default_category: { name: string; type: string } | null }[]>()
      if (error) throw error
      return data
    },
  })
  const contacts = directory.data?.map((c) => c.name) ?? []
  const [autoCategory, setAutoCategory] = useState(false)

  function onContactChange(v: string) {
    setContact(v)
    const hit = directory.data?.find((c) => c.name.toLocaleLowerCase() === v.trim().toLocaleLowerCase())
    const cat = hit?.default_category?.type === kind ? hit.default_category.name : null
    if (cat && (!category || autoCategory)) { setCategory(cat); setAutoCategory(true) }
  }

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
  const chosenCurrency = fxOpen ? otherCurrency : ''
  const effectiveCurrency = foreignAccount ? selected.currency : chosenCurrency || baseCurrency
  const cards = (accounts.data ?? []).filter((a) => a.subtype === 'credit_card' && a.currency === baseCurrency)
  // Taksitte hesap yalnız kredi kartı; tek kart varsa seçili gelir.
  const cardId = installment ? (cards.some((c) => c.id === accountId) ? accountId : cards.length === 1 ? cards[0].id : '') : ''
  const totalMinor = Math.round(Number(decimal(amount)) * 10 ** exponentOf(baseCurrency))
  const perInstallment = installment && Number(count) >= 2 && totalMinor > 0 ? Math.floor(totalMinor / Number(count)) : null
  const simple = !installment && !split && !items // döviz yalnız sade kayıtta
  const showFx = !editing && simple && (foreignAccount || (currencies.data?.length ?? 0) > 1)

  const save = useMutation({
    mutationFn: () => {
      const payload = { amount: decimal(amount), date, category_name: category, contact_name: contact }
      const extras = { description: noteOpen ? note.trim() || undefined : undefined, split: split ? splitPayload(split) : undefined, tags: tagsOpen ? tags : [] }
      const lineItems = items && itemsPayload(items).length ? itemsPayload(items) : undefined
      if (!editing && installment) {
        return callFunction<{ entry_id?: string }>('installment-create', {
          card_account_id: cardId, total_amount: payload.amount, installment_count: Number(count),
          category_name: category, contact_name: contact || undefined, date, ...extras,
        })
      }
      return editing
        ? callFunction<{ entry_id?: string }>('transaction-update', { entry_id: editing.id, ...payload, items: items ? itemsPayload(items) : [], tags: tagsOpen ? tags : [] })
        : callFunction<{ entry_id?: string }>('transaction-create', {
            kind, ...payload, ...extras, items: lineItems, contact_name: contact || undefined, account_id: accountId || undefined,
            currency: !foreignAccount && chosenCurrency ? chosenCurrency : undefined,
            rate: effectiveCurrency !== baseCurrency && fxOpen ? decimal(rate) || undefined : undefined,
            base_amount: !foreignAccount && chosenCurrency ? decimal(baseAmount) || undefined : undefined,
          })
    },
    onSuccess: (r) => {
      if (!editing && r.entry_id) afterSave(r.entry_id)
      else void queryClient.invalidateQueries()
      onDone?.()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const accountOptions = [{ value: '', label: t('accounts.subtype.cash') }, ...(accounts.data ?? []).map((a) => ({ value: a.id, label: a.name }))]

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <AmountField value={amount} onChange={setAmount} currency={effectiveCurrency} />
      <InputGroup>
        <InputGroupAddon><StoreIcon /></InputGroupAddon>
        <InputGroupInput
          id="contact" maxLength={100} autoComplete="off" list="contact-list"
          placeholder={t(`entry.contact.${kind}`)} aria-label={t(`entry.contact.${kind}`)}
          value={contact} onChange={(e) => onContactChange(e.target.value)}
        />
        <datalist id="contact-list">
          {contacts.map((n) => <option key={n} value={n} />)}
        </datalist>
      </InputGroup>
      <InputGroup>
        <InputGroupAddon><LayoutGridIcon /></InputGroupAddon>
        <InputGroupInput
          id="category" required maxLength={60} autoComplete="off" list="category-list"
          placeholder={t(`entry.category.${kind}`)} aria-label={t(`entry.category.${kind}`)}
          value={category} onChange={(e) => { setCategory(e.target.value); setAutoCategory(false) }}
        />
        <datalist id="category-list">
          {/* Üst kategori ipucu olarak görünür: "Taksi · Ulaşım" */}
          {categories.data?.map((c) => <option key={c.name} value={c.name} label={c.parent?.name} />)}
        </datalist>
      </InputGroup>

      <MetaRow>
        {!editing && !installment && accountOptions.length > 1 && (
          // Boş = otomatik (nakit hesap)
          <OptionSelect value={accountId} onChange={setAccountId} options={accountOptions} label={t(`entry.from.${kind}`)} className={chipClass} />
        )}
        <DateChip value={date} onChange={setDate} />
        <MoreChip open={more} onChange={setMore} />
      </MetaRow>

      {more && (
        <OptionChips>
          {/* Kalemler, taksit ve paylaştır birlikte kullanılmaz. Düzenlemede yalnız kalemler ve etiket değişir. */}
          {!editing && kind === 'expense' && (
            <>
              <Toggle variant="outline" size="sm" pressed={installment} disabled={!!items || fxOpen} onPressedChange={setInstallment}>{t('entry.installment.toggle')}</Toggle>
              <Toggle variant="outline" size="sm" pressed={!!split} disabled={!!items || fxOpen} onPressedChange={(p) => setSplit(p ? [{ name: '', share: '' }] : null)}>
                {t('entry.split.toggle')}
              </Toggle>
            </>
          )}
          {kind === 'expense' && (
            <Toggle
              variant="outline" size="sm" pressed={!!items} disabled={installment || !!split || foreignAccount || fxOpen}
              onPressedChange={(p) => setItems(p ? [{ category: '', amount: '' }] : null)}
            >
              {t('entry.items.toggle')}
            </Toggle>
          )}
          {showFx && <Toggle variant="outline" size="sm" pressed={fxOpen} onPressedChange={setFxOpen}>{t('entry.fx')}</Toggle>}
          {!editing && <Toggle variant="outline" size="sm" pressed={noteOpen} onPressedChange={setNoteOpen}>{t('entry.note')}</Toggle>}
          <Toggle variant="outline" size="sm" pressed={tagsOpen} onPressedChange={setTagsOpen}>{t('entry.tags.toggle')}</Toggle>
        </OptionChips>
      )}

      {installment && (
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="count">{t('entry.installment.count')}</FieldLabel>
            <Input id="count" required type="number" min={2} max={36} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="card">{t('entry.installment.card')}</FieldLabel>
            <OptionSelect
              id="card" value={cardId} onChange={setAccountId} placeholder={t('entry.installment.card')}
              options={cards.map((a) => ({ value: a.id, label: a.name }))} disabled={cards.length === 0}
            />
          </Field>
          {perInstallment !== null && (
            <FieldDescription className="col-span-2">{t('entry.installment.each', { amount: formatMinor(perInstallment, baseCurrency, i18n.language) })}</FieldDescription>
          )}
          {accounts.data && cards.length === 0 && <FieldDescription className="col-span-2">{t('entry.installment.noCard')}</FieldDescription>}
        </div>
      )}
      {split && <SplitEditor rows={split} onChange={setSplit} contacts={contacts} totalMinor={totalMinor} currency={baseCurrency} />}
      {items && <ItemsEditor rows={items} onChange={setItems} totalMinor={totalMinor} currency={baseCurrency} category={category} />}
      {fxOpen && showFx && (
        <div className="grid grid-cols-2 gap-3">
          {!foreignAccount && (
            <Field className="col-span-2">
              <FieldLabel htmlFor="currency">{t('accounts.currency')}</FieldLabel>
              <OptionSelect
                id="currency" value={otherCurrency} onChange={setOtherCurrency}
                options={[
                  { value: '', label: t('entry.sameCurrency', { currency: baseCurrency }) },
                  ...(currencies.data ?? []).filter((c) => c !== baseCurrency).map((c) => ({ value: c, label: c })),
                ]}
              />
            </Field>
          )}
          {effectiveCurrency !== baseCurrency && (
            <>
              <Input
                aria-label={t('accounts.rateHint', { from: effectiveCurrency, to: baseCurrency })}
                className={foreignAccount ? 'col-span-2' : undefined}
                inputMode="decimal" autoComplete="off" pattern={AMOUNT}
                placeholder={t('accounts.rateHint', { from: effectiveCurrency, to: baseCurrency })}
                value={rate} onChange={(e) => setRate(e.target.value)}
              />
              {!foreignAccount && (
                <Input
                  aria-label={t('entry.baseAmountHint', { currency: baseCurrency })}
                  inputMode="decimal" autoComplete="off" pattern={AMOUNT}
                  placeholder={t('entry.baseAmountHint', { currency: baseCurrency })}
                  value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)}
                />
              )}
            </>
          )}
        </div>
      )}
      {noteOpen && (
        <Field>
          <FieldLabel htmlFor="note">{t('entry.note')}</FieldLabel>
          <Input id="note" maxLength={200} autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      )}
      {tagsOpen && <TagsField value={tags} onChange={setTags} groupId={groupId} />}

      <EntryFooter error={save.error} pending={save.isPending} disabled={installment && !cardId} />
    </form>
  )
}
