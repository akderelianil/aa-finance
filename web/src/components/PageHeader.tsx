import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = { title: string; description?: string; icon?: LucideIcon; actions?: ReactNode }

// Sayfa başlığı: ikon rozeti + başlık + açıklama, sağda eylemler.
export function PageHeader({ title, description, icon: Icon, actions }: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
            <Icon className="size-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="truncate text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
