import { PlusIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { splitPayload, type SplitRow } from '@/lib/entry'
import { exponentOf, formatMinor } from '@/lib/money'

// Önizleme: sunucuyla aynı kural (boşlar + ben kalanı eşit böleriz, artan kuruş bende). Gösterim için number yeterli.
function myShare(total: number, rows: SplitRow[], currency: string): number | null {
  const people = splitPayload(rows)
  const unit = 10 ** exponentOf(currency)
  if (!people.length || !(total > 0)) return null
  let fixed = 0
  let blanks = 0
  for (const p of people) {
    if ('amount' in p && p.amount) fixed += Math.round(Number(p.amount) * unit)
    else if ('percent' in p && p.percent) fixed += Math.floor((total * Math.round(Number(p.percent) * 100)) / 10000)
    else blanks++
  }
  const rest = total - fixed
  if (Number.isNaN(rest) || rest < 0) return null
  return rest - Math.floor(rest / (blanks + 1)) * blanks
}

// Paylaştır: kişileri yaz, sistem eşit böler. "Daha fazla" ile kişi başı tutar veya yüzde.
export function SplitEditor({ rows, onChange, contacts, totalMinor, currency }: {
  rows: SplitRow[]
  onChange: (rows: SplitRow[]) => void
  contacts: string[]
  totalMinor: number
  currency: string
}) {
  const { t, i18n } = useTranslation()
  const [more, setMore] = useState(rows.some((r) => r.share))
  const set = (i: number, patch: Partial<SplitRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const mine = myShare(totalMinor, rows, currency)

  return (
    <Field>
      <FieldLabel>{t('entry.split.with')}</FieldLabel>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <Input
              aria-label={t('entry.split.person')} placeholder={t('entry.split.person')} maxLength={100} autoComplete="off"
              list="split-contact-list" value={r.name} onChange={(e) => set(i, { name: e.target.value })}
            />
            {more && (
              <Input
                aria-label={t('entry.split.share')} placeholder={t('entry.split.sharePlaceholder')} autoComplete="off"
                className="w-28 shrink-0" pattern="%?[0-9]+([.,][0-9]+)?%?"
                value={r.share} onChange={(e) => set(i, { share: e.target.value })}
              />
            )}
            {rows.length > 1 && (
              <Button type="button" size="icon" variant="ghost" aria-label={t('entry.split.remove')} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <XIcon />
              </Button>
            )}
          </div>
        ))}
        <datalist id="split-contact-list">
          {contacts.map((n) => <option key={n} value={n} />)}
        </datalist>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, { name: '', share: '' }])}>
            <PlusIcon data-icon="inline-start" />{t('entry.split.add')}
          </Button>
          {!more && <Button type="button" size="sm" variant="ghost" onClick={() => setMore(true)}>{t('entry.split.more')}</Button>}
        </div>
      </div>
      <FieldDescription>
        {mine === null ? t('entry.split.equalHint') : t('entry.split.mine', { amount: formatMinor(mine, currency, i18n.language) })}
      </FieldDescription>
    </Field>
  )
}
