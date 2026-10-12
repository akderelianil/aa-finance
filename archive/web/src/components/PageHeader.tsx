import type { ReactNode } from 'react'

type Props = { title: string; description?: string; actions?: ReactNode }

// Page title and subtitle on the left, actions on the right.
export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="truncate text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
