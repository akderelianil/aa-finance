import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = { title: string; description?: ReactNode; htmlFor?: string; children: ReactNode; className?: string; invalid?: boolean }

// One setting: title and hint on the left, the control on the right. Rows sit in a FramePanel with divide-y.
export function SettingRow({ title, description, htmlFor, children, className, invalid }: Props) {
  return (
    <div className={cn('flex items-center justify-between gap-6 px-4 py-3', className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <label htmlFor={htmlFor} className="text-sm font-medium">{title}</label>
        {description && <p className={cn('text-xs text-muted-foreground', invalid && 'text-destructive')}>{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}
