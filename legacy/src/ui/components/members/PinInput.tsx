import { OTPInputContext, REGEXP_ONLY_DIGITS } from 'input-otp'
import { useContext, useEffect, useRef, type Ref } from 'react'
import { InputOTP } from '@/components/ui/input-otp'
import { cn } from '@/lib/utils'

export const PIN_LENGTH = 6

function Slot({ index, invalid }: { index: number; invalid?: boolean }) {
  const { slots } = useContext(OTPInputContext)
  const { char, isActive } = slots[index] ?? {}
  return (
    <div
      data-active={isActive}
      aria-invalid={invalid || undefined}
      className={cn(
        'relative flex size-10 items-center justify-center rounded-lg border border-input text-2xl transition-colors dark:bg-input/30',
        'data-[active=true]:border-ring data-[active=true]:ring-3 data-[active=true]:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
      )}
    >
      {char ? '•' : null}
    </div>
  )
}

/** Six masked digit slots. The 6th digit calls `onComplete`; no button. */
export function PinInput({
  value, onChange, onComplete, disabled, invalid, autoFocus, label, inputRef, shake,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
  label: string
  inputRef?: Ref<HTMLInputElement>
  shake?: boolean
}) {
  const own = useRef<HTMLInputElement>(null)
  // A disabled input loses focus; take it back when it opens again.
  useEffect(() => {
    if (!disabled && autoFocus) own.current?.focus()
  }, [disabled, autoFocus])
  return (
    <InputOTP
      ref={(el) => {
        own.current = el
        if (typeof inputRef === 'function') inputRef(el)
        else if (inputRef) inputRef.current = el
      }}
      maxLength={PIN_LENGTH} value={value} onChange={onChange} onComplete={onComplete} disabled={disabled}
      pattern={REGEXP_ONLY_DIGITS} inputMode="numeric" autoComplete="off" autoFocus={autoFocus} aria-label={label}
      containerClassName={cn('justify-center', shake && 'animate-pin-shake motion-reduce:animate-none')}
    >
      <div className="flex gap-2">
        {Array.from({ length: PIN_LENGTH }, (_, i) => <Slot key={i} index={i} invalid={invalid} />)}
      </div>
    </InputOTP>
  )
}
