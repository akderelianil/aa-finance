import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccountNode } from '@/lib/ledger'
import { cn } from '@/lib/utils'

/** What the picker needs of an account; a Rehber record fits too (path = its kind, no currency). */
export type PickerItem = Pick<AccountNode, 'id' | 'label' | 'path' | 'currency'>

type Props = {
  /** Postable accounts: no group account, not archived. */
  accounts: PickerItem[]
  value: string
  onChange: (id: string) => void
  autoFocus?: boolean
  invalid?: boolean
  className?: string
  'aria-label'?: string
  /** Offers "+ name" for a typed name with no match; picking it sets the value to `new:<name>`. */
  creatable?: boolean
  placeholder?: string
}

export const NEW = 'new:'

// Keyboard account picker for the journal grid: type part of a name or of its group, arrows move,
// Enter or Tab picks the highlighted account, Escape restores the value.
export function AccountPicker({ accounts, value, onChange, autoFocus, className, invalid, creatable, placeholder, ...aria }: Props) {
  const { t, i18n } = useTranslation()
  const selected = accounts.find((a) => String(a.id) === value)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const matches = useMemo(() => {
    if (query === null) return []
    const q = query.trim().toLocaleLowerCase(i18n.language)
    const found = accounts.filter((a) => !q || `${a.path} ${a.label}`.toLocaleLowerCase(i18n.language).includes(q)).slice(0, 40)
    const name = query.trim()
    const exact = found.some((a) => a.label.toLocaleLowerCase(i18n.language) === q)
    return creatable && name && !exact ? [...found, { id: NEW + name, label: name, path: '', currency: '', created: true }] : found
  }, [accounts, query, i18n.language, creatable])

  function pick(a: { id: string | number } | undefined) {
    if (a) onChange(String(a.id))
    setQuery(null)
  }

  function move(to: number) {
    setActive(to)
    listRef.current?.children[to]?.scrollIntoView({ block: 'nearest' })
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (query === null) {
      if (e.key === 'ArrowDown') { setQuery(''); setActive(0) }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(Math.min(active + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(Math.max(active - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); pick(matches[active]) }
    else if (e.key === 'Tab') { if (query.trim()) pick(matches[active]); else setQuery(null) }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setQuery(null) }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        {...aria}
        aria-invalid={invalid || undefined}
        autoFocus={autoFocus}
        className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-input focus:border-ring focus:bg-background aria-invalid:border-destructive"
        value={query ?? (selected ? selected.label : value.startsWith(NEW) ? value.slice(NEW.length) : '')}
        placeholder={placeholder ?? t('gj.pickAccount')}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => { setQuery(e.target.value); setActive(0) }}
        onKeyDown={onKeyDown}
        onBlur={() => setQuery(null)}
        role="combobox"
        aria-expanded={query !== null}
        aria-autocomplete="list"
      />
      {query !== null && matches.length > 0 && (
        <ul
          ref={listRef} role="listbox"
          className="absolute top-full left-0 z-50 mt-1 max-h-72 w-[28rem] overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-lg"
        >
          {matches.map((a, i) => (
            <li
              key={a.id} role="option" aria-selected={i === active}
              className={cn('flex cursor-default gap-3 rounded px-2 py-1', i === active && 'bg-accent text-accent-foreground')}
              onMouseDown={(e) => { e.preventDefault(); pick(a) }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="flex-1 truncate">{'created' in a ? t('quick.newAccount', { name: a.label }) : a.label}</span>
              <span className="max-w-48 truncate text-muted-foreground">{a.path}</span>
              <span className="font-mono text-muted-foreground">{a.currency}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
