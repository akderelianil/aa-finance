import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { CheckIcon, SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type SearchItem = { value: string; label: string; hint?: string }

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

/**
 * A search box over an always-open list (combobox pattern). ↑↓ select, Enter selects and calls onEnter,
 * Esc clears the search first, then bubbles.
 */
export function SearchList({ id, items, value, onChange, onEnter, placeholder, empty, first }: {
  id: string
  items: SearchItem[]
  value: string | null
  onChange: (value: string) => void
  onEnter?: () => void
  placeholder: string
  empty: string
  /** The step's first field (Setup focuses [data-first]). */
  first?: boolean
}) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = fold(query.trim())
    return q ? items.filter((i) => fold(`${i.label} ${i.value}`).includes(q)) : items
  }, [items, query])
  const active = Math.max(0, shown.findIndex((i) => i.value === value))
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' })
  }, [value, shown])

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const move = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (move) {
      e.preventDefault()
      const next = shown[Math.min(shown.length - 1, Math.max(0, active + move))]
      if (next) onChange(next.value)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const pick = shown[active]
      if (!pick) return
      onChange(pick.value)
      onEnter?.()
    } else if (e.key === 'Escape' && query) {
      e.stopPropagation()
      setQuery('')
    }
  }

  function search(q: string) {
    setQuery(q)
    const first = items.find((i) => fold(`${i.label} ${i.value}`).includes(fold(q.trim())))
    if (first && q.trim()) onChange(first.value)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          role="combobox"
          aria-expanded
          aria-controls={`${id}-list`}
          aria-activedescendant={shown[active] ? `${id}-${shown[active].value}` : undefined}
          aria-label={placeholder}
          placeholder={placeholder}
          className="pl-8"
          value={query}
          data-first={first || undefined}
          autoComplete="off"
          onChange={(e) => search(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <div ref={list} id={`${id}-list`} role="listbox" aria-label={placeholder} className="h-56 overflow-y-auto rounded-md border p-1">
        {shown.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{empty}</p>}
        {shown.map((i) => (
          <div
            key={i.value}
            id={`${id}-${i.value}`}
            role="option"
            aria-selected={i.value === value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(i.value)}
            onDoubleClick={() => onEnter?.()}
            className={cn(
              'flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-muted',
              i.value === value && 'bg-primary/10 font-medium hover:bg-primary/10',
            )}
          >
            <span className="min-w-0 flex-1 truncate">{i.label}</span>
            {i.hint && <span className="text-xs text-muted-foreground tabular-nums">{i.hint}</span>}
            <CheckIcon aria-hidden className={cn('size-4 text-primary', i.value !== value && 'invisible')} />
          </div>
        ))}
      </div>
    </div>
  )
}
