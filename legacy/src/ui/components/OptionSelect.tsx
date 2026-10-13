import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type Option = { value: string; label: string }

// Base UI Select: items prop zorunlu; boş seçim için value'su null olan öğe kullanılır.
export function OptionSelect({ value, onChange, options, placeholder, label, id, disabled, className }: {
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholder?: string
  label?: string
  id?: string
  disabled?: boolean
  className?: string
}) {
  const items = [...(placeholder ? [{ value: null, label: placeholder }] : []), ...options]
  return (
    <Select
      items={items} value={options.some((o) => o.value === '') ? value : (value || null)}
      onValueChange={(v) => onChange(v ?? '')} disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={label} className={className ?? 'w-full'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((o) => (
            <SelectItem key={o.value ?? 'none'} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
