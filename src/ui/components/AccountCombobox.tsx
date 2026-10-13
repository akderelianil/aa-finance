import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'
import type { AccountNode } from '@/lib/ledger'

/** What the picker needs of an account; a Rehber record fits too (path = its kind, no currency). */
export type PickerItem = Pick<AccountNode, 'id' | 'label' | 'path' | 'currency'>

/** A typed name with no match is offered as a new record; picking it sets the value to `new:<name>`. */
export const NEW = 'new:'

type Row = { value: string; label: string; path: string; currency: string; created?: boolean }

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

/**
 * Searchable account or contact picker (ReUI combobox). Type part of a name or of its group; ↑↓ move,
 * Enter or Tab pick the highlighted row, Esc restores the value. `inline` drops the border for grid cells.
 */
export function AccountCombobox({ accounts, value, onChange, autoFocus, invalid, creatable, placeholder, createLabel, inline, className, ...aria }: {
  /** Postable accounts: no group account, not archived. */
  accounts: PickerItem[]
  value: string
  onChange: (id: string) => void
  autoFocus?: boolean
  invalid?: boolean
  creatable?: boolean
  placeholder?: string
  /** Text of the "new" row; defaults to a new account. */
  createLabel?: (name: string) => string
  inline?: boolean
  className?: string
  'aria-label'?: string
}) {
  const { t } = useTranslation()
  const rows = useMemo<Row[]>(() => accounts.map((a) => ({ value: String(a.id), label: a.label, path: a.path, currency: a.currency })), [accounts])
  const selected = rows.find((r) => r.value === value) ?? (value.startsWith(NEW) ? { value, label: value.slice(NEW.length), path: '', currency: '', created: true } : null)

  const [input, setInput] = useState(selected?.label ?? '')
  const [query, setQuery] = useState('')
  const highlighted = useRef<Row | undefined>(undefined)
  useEffect(() => { setInput(selected?.label ?? '') }, [selected?.label])

  const shown = useMemo<Row[]>(() => {
    const q = fold(query.trim())
    const found = rows.filter((r) => !q || fold(`${r.path} ${r.label}`).includes(q)).slice(0, 40)
    const name = query.trim()
    return creatable && name && !rows.some((r) => fold(r.label) === q)
      ? [...found, { value: NEW + name, label: name, path: '', currency: '', created: true }]
      : found
  }, [rows, query, creatable])

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab' && query.trim() && highlighted.current) onChange(highlighted.current.value)
  }

  return (
    <Combobox
      items={shown} value={selected} filter={null} inputValue={input} autoHighlight
      isItemEqualToValue={(a, b) => a.value === b.value}
      itemToStringLabel={(r) => r.label}
      onItemHighlighted={(r) => { highlighted.current = r }}
      onValueChange={(r) => { if (r) onChange(r.value) }}
      onInputValueChange={(v, d) => { setInput(v); if (d.reason === 'input-change') setQuery(v) }}
      onOpenChange={(open) => { if (!open) { setQuery(''); setInput(selected?.label ?? '') } }}
    >
      <ComboboxInput
        {...aria} showTrigger={!inline} autoFocus={autoFocus} aria-invalid={invalid || undefined} onKeyDown={onKeyDown}
        onFocus={(e) => e.currentTarget.select()} placeholder={placeholder ?? t('gj.pickAccount')}
        className={inline ? 'border-transparent bg-transparent hover:border-input dark:bg-transparent' : className}
      />
      <ComboboxContent className="w-[28rem] max-w-(--available-width)">
        <ComboboxEmpty>{t('common.noMatch')}</ComboboxEmpty>
        <ComboboxList>
          {(r: Row) => (
            <ComboboxItem key={r.value} value={r}>
              <span className="flex-1 truncate">{r.created ? (createLabel ?? ((name) => t('quick.newAccountRow', { name })))(r.label) : r.label}</span>
              <span className="max-w-48 truncate text-xs text-muted-foreground">{r.path}</span>
              <span className="font-mono text-xs text-muted-foreground">{r.currency}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
