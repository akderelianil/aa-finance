import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { compareCodes, type AccountNode } from '@/lib/ledger'
import { cn } from '@/lib/utils'

type Props = {
  accounts: AccountNode[] // postable accounts (no placeholder, not archived)
  value: string
  onChange: (id: string) => void
  autoFocus?: boolean
  className?: string
  'aria-label'?: string
}

const label = (a: AccountNode) => a.name

// Keyboard account picker for the journal grid: type part of a name or of its group, arrows move,
// Enter or Tab picks the highlighted account, Escape restores the value.
export function AccountPicker({ accounts, value, onChange, autoFocus, className, ...aria }: Props) {
  const { t, i18n } = useTranslation()
  const selected = accounts.find((a) => a.id === value)
  const [query, setQuery] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const matches = useMemo(() => {
    if (query === null) return []
    const q = query.trim().toLocaleLowerCase(i18n.language)
    return accounts
      .filter((a) => !q || `${a.path} ${a.name}`.toLocaleLowerCase(i18n.language).includes(q))
      .sort((a, b) => compareCodes(a.code, b.code))
      .slice(0, 40)
  }, [accounts, query, i18n.language])

  function pick(a: AccountNode | undefined) {
    if (a) onChange(a.id)
    setQuery(null)
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
      pick(matches[active])
    } else if (e.key === 'Tab') {
      if (query.trim()) pick(matches[active])
      else setQuery(null)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setQuery(null)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        {...aria}
        autoFocus={autoFocus}
        className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-input focus:border-ring focus:bg-background"
        value={query ?? (selected ? label(selected) : '')}
        placeholder={t('gj.pickAccount')}
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
              <span className="flex-1 truncate">{a.name}</span>
              <span className="max-w-48 truncate text-muted-foreground">{a.path}</span>
              <span className="font-mono text-muted-foreground">{a.currency}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
