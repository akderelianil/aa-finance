import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import { NEW } from '@/components/journal/AccountPicker'

export type PersonItem = { value: string; label: string; hint: string }

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

/**
 * Rehber picker: type to narrow, pick a contact or "+ Yeni kişi: name" (value `new:<name>`).
 * Filtering is done here so the create row follows the typed text.
 */
export function PersonCombobox({ people, value, onChange, invalid, placeholder, ...aria }: {
  people: PersonItem[]
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  placeholder?: string
  'aria-label'?: string
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const typed = value.startsWith(NEW) ? value.slice(NEW.length) : ''
  const selected = people.find((p) => p.value === value) ?? (typed ? { value, label: typed, hint: '' } : null)

  const items = useMemo(() => {
    const q = fold(query.trim())
    const found = q ? people.filter((p) => fold(`${p.label} ${p.hint}`).includes(q)) : people
    const name = query.trim()
    const exact = people.some((p) => fold(p.label) === q)
    return name && !exact ? [...found, { value: NEW + name, label: t('quick.newAccount', { name }), hint: '' }] : found
  }, [people, query, t])

  return (
    <Combobox
      items={items} value={selected} filter={null} inputValue={query} autoHighlight
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(p) => (p.value.startsWith(NEW) && p.value !== value ? query : p.label.replace(/^\+ [^:]+: /, ''))}
      onInputValueChange={setQuery}
      onValueChange={(p) => onChange(p?.value ?? '')}
    >
      <ComboboxInput onFocus={(e) => e.currentTarget.select()} placeholder={placeholder} aria-invalid={invalid || undefined} {...aria} />
      <ComboboxContent>
        <ComboboxEmpty>{t('common.noMatch')}</ComboboxEmpty>
        <ComboboxList>
          {(p: PersonItem) => (
            <ComboboxItem key={p.value} value={p}>
              <span className="flex-1 truncate">{p.label}</span>
              {p.hint && <span className="text-xs text-muted-foreground">{p.hint}</span>}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
