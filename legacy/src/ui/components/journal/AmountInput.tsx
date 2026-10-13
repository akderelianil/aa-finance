import type { KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { tidyAmount } from '@/lib/amount'
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
  className?: string
  placeholder?: string
  autoFocus?: boolean
  'aria-label'?: string
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}

// Money field: only digits and separators, the currency at the end, decimals tidied on blur.
export function AmountInput({ value, onChange, currency, exponent = 2, invalid, tidy = true, className, ...rest }: Props) {
  return (
    <div className="relative">
      <Input
        inputMode="decimal" autoComplete="off" aria-invalid={invalid || undefined}
        className={cn('text-end text-foreground tabular-nums', currency && 'pe-11', className)}
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
