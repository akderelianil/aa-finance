import { useMutation } from '@tanstack/react-query'
import { ArrowRightIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { AmountField, DateChip, EntryFooter, MetaRow, MoreChip, OptionChips, TagsField } from '@/components/entry/Fields'
import { OptionSelect } from '@/components/OptionSelect'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/ui/toggle'
import { callFunction } from '@/lib/api'
import { AMOUNT, decimal, expectedReturn, today, useAfterSave, useMyAccounts, type EntryPreset } from '@/lib/entry'
import { exponentOf, formatMinor } from '@/lib/money'

const MOVABLE = ['cash', 'bank', 'credit_card', 'loan', 'other']
const NEW_DEPOSIT = '__deposit'
const CASH = '__cash' // nakit hesabı henüz yok: sunucu açar

// Kendi hesapların arasında para. Kısayollar Nereden/Nereye'yi doldurur: ATM'den çek, ATM'ye yatır, kart borcu öde.
// Hedef kredi kartıysa kart ödemesi; kart → nakit ise nakit avans (komisyon sorulur);
// hedef "Yeni vadeli hesap" ise vadeli açılır (anapara + yıllık oran + gün; beklenen getiri gösterilir).
export function TransferForm({ membership, preset, onDone }: {
  membership: Membership
  preset?: Extract<EntryPreset, { kind: 'transfer' }>
  onDone?: () => void
}) {
  const { t, i18n } = useTranslation()
  const afterSave = useAfterSave()
  const currency = membership.group.base_currency
  const accounts = useMyAccounts(membership)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(preset?.to ?? '')
  const [amount, setAmount] = useState(preset?.amount ?? '')
  const [date, setDate] = useState(today)
  const [fee, setFee] = useState('')
  const [rate, setRate] = useState('')
  const [days, setDays] = useState('32')
  const [withholding, setWithholding] = useState('')
  const [more, setMore] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tags, setTags] = useState<string[]>([])

  const mine = (accounts.data ?? []).filter((a) => a.currency === currency && MOVABLE.includes(a.subtype ?? 'other'))
  const of = (subtype: string) => mine.filter((a) => a.subtype === subtype)
  const cashId = of('cash')[0]?.id ?? CASH
  const only = (subtype: string) => (of(subtype).length === 1 ? of(subtype)[0].id : '')
  const options = [
    ...mine.map((a) => ({ value: a.id, label: a.name })),
    ...(cashId === CASH ? [{ value: CASH, label: t('accounts.subtype.cash') }] : []),
  ]
  const subtypeOf = (id: string) => (id === CASH ? 'cash' : mine.find((a) => a.id === id)?.subtype)
  // Yaklaşanlar'dan açıldıysa ve tek banka hesabı varsa kaynak hazır gelir.
  const fromId = from || (preset ? only('bank') : '')
  const toCard = subtypeOf(to) === 'credit_card'
  const advance = subtypeOf(fromId) === 'credit_card' && subtypeOf(to) === 'cash'
  const deposit = to === NEW_DEPOSIT
  const unit = 10 ** exponentOf(currency)
  const expected = expectedReturn(Math.round(Number(decimal(amount)) * unit), Number(decimal(rate)), Number(days), Number(decimal(withholding) || 0))

  const shortcuts = [
    { key: 'atmWithdraw', from: only('bank'), to: cashId },
    { key: 'atmDeposit', from: cashId, to: only('bank') },
    { key: 'cardPay', from: only('bank'), to: only('credit_card') },
  ] as const
  const idOrCash = (id: string) => (id === CASH ? undefined : id)

  const save = useMutation({
    mutationFn: () => deposit
      ? callFunction<{ entry_id: string }>('deposit-open', {
          from_account_id: idOrCash(fromId), amount: decimal(amount), annual_rate: decimal(rate), days: Number(days),
          withholding_rate: withholding ? decimal(withholding) : undefined, date, tags: tagsOpen ? tags : [],
        })
      : callFunction<{ entry_id: string }>('transfer-create', {
          from_account_id: idOrCash(fromId), to_account_id: idOrCash(to), amount: decimal(amount), date,
          fee: advance && fee ? decimal(fee) : undefined, tags: tagsOpen ? tags : [],
        }),
    onSuccess: (r) => { afterSave(r.entry_id); onDone?.() },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="flex flex-col gap-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label={t('entry.shortcut.label')}>
        {shortcuts.map((s) => (
          <Toggle
            key={s.key} variant="outline" size="sm" className="shrink-0" pressed={fromId === s.from && to === s.to && !!s.from && !!s.to}
            onPressedChange={() => { setFrom(s.from); setTo(s.to) }}
          >
            {t(`entry.shortcut.${s.key}`)}
          </Toggle>
        ))}
      </div>
      <AmountField value={amount} onChange={setAmount} currency={currency} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <Field>
          <FieldLabel className="text-xs text-muted-foreground">{t('accounts.from')}</FieldLabel>
          <OptionSelect value={fromId} onChange={setFrom} options={options.filter((o) => o.value !== to)} placeholder={t('entry.choose')} label={t('accounts.from')} />
        </Field>
        <ArrowRightIcon className="mb-2.5 size-4 text-muted-foreground" aria-hidden />
        <Field>
          <FieldLabel className="text-xs text-muted-foreground">{t('accounts.to')}</FieldLabel>
          <OptionSelect
            value={to} onChange={setTo} placeholder={t('entry.choose')} label={t('accounts.to')}
            options={[...options.filter((o) => o.value !== fromId), { value: NEW_DEPOSIT, label: t('entry.deposit.new') }]}
          />
        </Field>
      </div>
      {toCard && <FieldDescription>{t('entry.cardPayment')}</FieldDescription>}
      {advance && (
        <Field>
          <FieldLabel htmlFor="tr-fee">{t('entry.atm.fee')}</FieldLabel>
          <Input id="tr-fee" inputMode="decimal" autoComplete="off" placeholder="0,00" pattern={AMOUNT} value={fee} onChange={(e) => setFee(e.target.value)} />
          <FieldDescription>{t('entry.atm.advanceHint')}</FieldDescription>
        </Field>
      )}
      {deposit && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel htmlFor="dep-rate">{t('entry.deposit.rate')}</FieldLabel>
              <Input id="dep-rate" required inputMode="decimal" autoComplete="off" pattern={AMOUNT} value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dep-days">{t('entry.deposit.days')}</FieldLabel>
              <Input id="dep-days" required type="number" min={1} max={3660} value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dep-wh">{t('entry.deposit.withholding')}</FieldLabel>
              <Input id="dep-wh" inputMode="decimal" autoComplete="off" pattern={AMOUNT} placeholder="0" value={withholding} onChange={(e) => setWithholding(e.target.value)} />
            </Field>
          </div>
          {expected > 0 && (
            <FieldDescription>{t('entry.deposit.expected', { amount: formatMinor(expected, currency, i18n.language) })}</FieldDescription>
          )}
        </>
      )}
      <MetaRow>
        <DateChip value={date} onChange={setDate} />
        <MoreChip open={more} onChange={setMore} />
      </MetaRow>
      {more && (
        <OptionChips>
          <Toggle variant="outline" size="sm" pressed={tagsOpen} onPressedChange={setTagsOpen}>{t('entry.tags.toggle')}</Toggle>
        </OptionChips>
      )}
      {tagsOpen && <TagsField value={tags} onChange={setTags} groupId={membership.group.id} />}
      <EntryFooter error={save.error} pending={save.isPending} disabled={!fromId || !to} />
      <div className="-mt-3 flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
        <span>{t('entry.other')}:</span>
        <Button variant="link" size="xs" nativeButton={false} render={<Link to="/hesaplar" />} onClick={onDone}>{t('entry.otherFx')}</Button>
        <Button variant="link" size="xs" nativeButton={false} render={<Link to="/ayarlar/yatirimlar" />} onClick={onDone}>{t('entry.otherInvest')}</Button>
      </div>
    </form>
  )
}
