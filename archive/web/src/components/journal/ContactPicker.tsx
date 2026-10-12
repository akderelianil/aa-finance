import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Contact } from '@/lib/contacts'
import { cn } from '@/lib/utils'

type Props = {
  contacts: Contact[] // active contacts
  value: string
  onChange: (id: string) => void
  placeholder?: string
  className?: string
  invalid?: boolean
  'aria-label'?: string
}

// Keyboard Rehber picker, same behavior as AccountPicker: type part of a name, arrows move, Enter or Tab picks.
// An empty text picks nothing (clears the value); Escape restores the value.
export function ContactPicker({ contacts, value, onChange, placeholder, className, invalid, ...aria }: Props) {
  const { t, i18n } = useTranslation()
  const selected = contacts.find((c) => c.id === value)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const matches = useMemo(() => {
    if (query === null) return []
    const q = query.trim().toLocaleLowerCase(i18n.language)
    return contacts.filter((c) => !q || c.name.toLocaleLowerCase(i18n.language).includes(q)).slice(0, 40)
  }, [contacts, query, i18n.language])

  function pick(c: Contact | undefined) {
    if (c) onChange(c.id)
    setQuery(null)
  }
  function commit() {
    if (query === null) return
    if (!query.trim()) { onChange(''); setQuery(null) } else pick(matches[active])
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (query === null) {
      if (e.key === 'ArrowDown') { setQuery(''); setActive(0) }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, matches.length - 1))
      listRef.current?.children[Math.min(active + 1, matches.length - 1)]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
      listRef.current?.children[Math.max(active - 1, 0)]?.scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Tab') {
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setQuery(null)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        {...aria}
        aria-invalid={invalid || undefined}
        className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-input focus:border-ring focus:bg-background aria-invalid:border-destructive"
        value={query ?? selected?.name ?? ''}
        placeholder={placeholder ?? t('directory.pick')}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => { setQuery(e.target.value); setActive(0) }}
        onKeyDown={onKeyDown}
        onBlur={() => { if (query !== null && !query.trim()) onChange(''); setQuery(null) }}
        role="combobox"
        aria-expanded={query !== null}
        aria-autocomplete="list"
      />
      {query !== null && matches.length > 0 && (
        <ul
          ref={listRef} role="listbox"
          className="absolute top-full left-0 z-50 mt-1 max-h-72 w-80 overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-lg"
        >
          {matches.map((c, i) => (
            <li
              key={c.id} role="option" aria-selected={i === active}
              className={cn('flex cursor-default gap-3 rounded px-2 py-1', i === active && 'bg-accent text-accent-foreground')}
              onMouseDown={(e) => { e.preventDefault(); pick(c) }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs text-muted-foreground">{t(`directory.kinds.${c.kind}`)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
