import { CalendarIcon, ChevronDownIcon, XIcon } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Toggle } from '@/components/ui/toggle'
import { AMOUNT, chipClass, today, useGroupTags } from '@/lib/entry'
import { errorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'

// Formun odağı: büyük, ortada tutar.
export function AmountField({ value, onChange, currency }: { value: string; onChange: (v: string) => void; currency: string }) {
  const { t } = useTranslation()
  return (
    <Field className="items-center gap-1 rounded-3xl bg-muted/60 px-4 py-3">
      <FieldLabel htmlFor="amount" className="justify-center text-xs font-normal text-muted-foreground">{t('entry.amount')} · {currency}</FieldLabel>
      <input
        id="amount" required autoFocus inputMode="decimal" autoComplete="off" placeholder="0,00"
        pattern={AMOUNT} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 bg-transparent text-center text-4xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
      />
    </Field>
  )
}

// Tarih çipi: "Bugün" / "Dün" / "3 Eki"; dokununca tarih seçici açılır.
export function DateChip({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const { t, i18n } = useTranslation()
  const d = new Date(`${today()}T00:00:00`)
  d.setDate(d.getDate() - 1)
  const yesterday = d.toLocaleDateString('sv-SE')
  const text = value === today() ? t('entry.today') : value === yesterday ? t('entry.yesterday')
    : value ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(new Date(`${value}T00:00:00`)) : t('entry.date')
  return (
    <label className={cn('relative inline-flex shrink-0 cursor-pointer self-start items-center border border-input bg-background focus-within:ring-3 focus-within:ring-ring/50', chipClass)}>
      <CalendarIcon className="size-4 text-muted-foreground" aria-hidden />
      {label ? `${label}: ${text}` : text}
      <input
        type="date" required max={today()} value={value} aria-label={label ?? t('entry.date')}
        onChange={(e) => onChange(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  )
}

// Formun alt satırı: hesap · tarih · "Daha fazla" çipleri.
export function MetaRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

export function MoreChip({ open, onChange }: { open: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation()
  return (
    <Toggle variant="outline" className={chipClass} pressed={open} onPressedChange={onChange}>
      {t('entry.more')}
      <ChevronDownIcon className={cn('transition-transform', open && 'rotate-180')} />
    </Toggle>
  )
}

// "Daha fazla" açılınca görünen seçenek çipleri.
export function OptionChips({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return <div className="flex flex-wrap gap-2" role="group" aria-label={t('entry.options')}>{children}</div>
}

// Etiket girişi: yaz + Enter (ya da listeden seç) → çip. Grupta daha önce kullanılanlar önerilir.
export function TagsField({ value, onChange, groupId }: { value: string[]; onChange: (v: string[]) => void; groupId: string }) {
  const { t } = useTranslation()
  const tags = useGroupTags(groupId)
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const s = raw.trim().replace(/^#/, '').trim().slice(0, 40)
    setDraft('')
    if (!s || value.length >= 10 || value.some((v) => v.toLocaleLowerCase() === s.toLocaleLowerCase())) return
    onChange([...value, s])
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) { e.preventDefault(); add(draft) }
    if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
  }

  return (
    <Field>
      <FieldLabel htmlFor="tags">{t('entry.tags.label')}</FieldLabel>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-xl border border-input px-2 py-1 focus-within:ring-3 focus-within:ring-ring/50">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2 text-xs text-secondary-foreground">
            #{tag}
            <button type="button" className="rounded-full p-0.5 hover:bg-foreground/10" aria-label={t('entry.tags.remove', { tag })}
              onClick={() => onChange(value.filter((v) => v !== tag))}>
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <Input
          id="tags" list="tag-list" autoComplete="off" maxLength={40} placeholder={value.length ? '' : t('entry.tags.placeholder')}
          className="h-7 min-w-24 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
          value={draft} onKeyDown={onKeyDown} onBlur={() => add(draft)}
          onChange={(e) => {
            // Listeden seçim: tam ad gelir, hemen çip olur.
            const native = e.nativeEvent as InputEvent
            if (!native.inputType || native.inputType === 'insertReplacementText') add(e.target.value)
            else setDraft(e.target.value)
          }}
        />
        <datalist id="tag-list">
          {tags.data?.filter((x) => !value.includes(x.name)).map((x) => <option key={x.id} value={x.name} />)}
        </datalist>
      </div>
    </Field>
  )
}

// Sabit alt çubuk: hata + tam genişlikte Kaydet (kapatmak için pencere/çekmece kapanır).
export function EntryFooter({ error, pending, disabled }: { error: unknown; pending: boolean; disabled?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 bg-popover px-1 pt-2 pb-4">
      <FormError message={error ? errorMessage(t, error) : null} />
      <Button type="submit" size="lg" className="w-full" disabled={pending || disabled}>
        {pending && <Spinner data-icon="inline-start" />}
        {t('entry.save')}
      </Button>
    </div>
  )
}
