import type { KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { tidyAmount } from '@/lib/entryRules'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (v: string) => void
  currency?: string
  /** Decimal places of the currency; the field tidies "12" to "12.00" when it loses focus. */
  exponent?: number
  invalid?: boolean
  /** false for rates: no padding of the decimals on blur. */
  tidy?: boolean
  /** Large single amount field. */
  hero?: boolean
  className?: string
  placeholder?: string
  autoFocus?: boolean
  'aria-label'?: string
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}

// Money field: accepts only digits and separators (a letter never lands in it), shows the currency at the end
// and tidies the decimals on blur. The message and the red state come from the caller (`invalid`).
export function AmountInput({ value, onChange, currency, exponent = 2, invalid, tidy = true, hero, className, ...rest }: Props) {
  return (
    <div className="relative">
      <Input
        inputMode="decimal" autoComplete="off" aria-invalid={invalid || undefined}
        className={cn('text-end text-foreground tabular-nums', currency && (hero ? 'pe-14' : 'pe-11'), hero && 'h-12 text-2xl font-semibold md:text-2xl', className)}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ''))}
        onBlur={() => { if (tidy && value.trim()) onChange(tidyAmount(value.trim(), exponent)) }}
        {...rest}
      />
      {currency && (
        <span className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-xs text-muted-foreground">{currency}</span>
      )}
    </div>
  )
}
