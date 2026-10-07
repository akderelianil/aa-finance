import { PlusIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AMOUNT, itemsPayload, type ItemRow } from '@/lib/entry'
import { exponentOf, formatMinor } from '@/lib/money'

// Fişteki diğer kalemler (ör. marketten alkol). Toplamdan kalan ana kategoriye yazılır.
export function ItemsEditor({ rows, onChange, totalMinor, currency, category }: {
  rows: ItemRow[]
  onChange: (rows: ItemRow[]) => void
  totalMinor: number
  currency: string
  category: string
}) {
  const { t, i18n } = useTranslation()
  const set = (i: number, patch: Partial<ItemRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const unit = 10 ** exponentOf(currency)
  const rest = totalMinor - itemsPayload(rows).reduce((s, r) => s + Math.round(Number(r.amount) * unit), 0)

  return (
    <Field>
      <FieldLabel>{t('entry.items.with')}</FieldLabel>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <Input
              aria-label={t('entry.category')} placeholder={t('entry.category')} maxLength={60} autoComplete="off"
              list="category-list" value={r.category} onChange={(e) => set(i, { category: e.target.value })}
            />
            <Input
              aria-label={t('entry.amount')} placeholder="0,00" inputMode="decimal" autoComplete="off" pattern={AMOUNT}
              className="w-28 shrink-0" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })}
            />
            {rows.length > 1 && (
              <Button type="button" size="icon" variant="ghost" aria-label={t('entry.split.remove')} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <XIcon />
              </Button>
            )}
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => onChange([...rows, { category: '', amount: '' }])}>
          <PlusIcon data-icon="inline-start" />{t('entry.items.add')}
        </Button>
      </div>
      {totalMinor > 0 && (
        <FieldDescription>
          {rest > 0
            ? t('entry.items.rest', { amount: formatMinor(rest, currency, i18n.language), category: category || t('entry.category') })
            : t('errors.items_exceed_total')}
        </FieldDescription>
      )}
    </Field>
  )
}
