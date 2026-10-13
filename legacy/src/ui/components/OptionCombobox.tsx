import { useTranslation } from 'react-i18next'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import type { Option } from '@/components/OptionSelect'

/**
 * Searchable single choice for long lists (country, currency, accounts). Same props as OptionSelect;
 * with a `placeholder` the choice can be cleared back to ''. Short fixed lists stay on OptionSelect.
 */
export function OptionCombobox({ value, onChange, options, placeholder, label, id, disabled, className }: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
  label?: string
  id?: string
  disabled?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const selected = options.find((o) => o.value === value) ?? null
  return (
    <Combobox
      items={options} value={selected} disabled={disabled} autoHighlight
      isItemEqualToValue={(a, b) => a.value === b.value}
      onValueChange={(o) => onChange(o?.value ?? '')}
    >
      <ComboboxInput id={id} aria-label={label} className={className ?? 'w-full'} onFocus={(e) => e.currentTarget.select()} placeholder={placeholder ?? t('common.search')} showClear={!!placeholder && !!selected} />
      <ComboboxContent>
        <ComboboxEmpty>{t('common.noMatch')}</ComboboxEmpty>
        <ComboboxList>
          {(o: Option) => <ComboboxItem key={o.value} value={o}>{o.label}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
