import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'success' | 'danger' | 'info' | 'warning'

const TONE: Record<Tone, string> = {
  neutral: 'bg-muted text-foreground',
  success: 'bg-success/10 text-success',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/15 text-warning',
}

type Props = {
  label: string
  value: string
  icon: LucideIcon
  tone?: Tone
  loading?: boolean
  // Değerin yanındaki küçük rozet (ör. önceki aya göre yüzde).
  badge?: { text: string; variant?: 'success' | 'destructive' | 'secondary' | 'info' | 'warning' }
  hint?: string
}

// Özet kartı: ikon rozeti + etiket + büyük değer.
export function StatCard({ label, value, icon: Icon, tone = 'neutral', loading, badge, hint }: Props) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start gap-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-2xl', TONE[tone])} aria-hidden>
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
          {loading ? (
            <Skeleton className="mt-1 h-7 w-28" />
          ) : (
            <span className="truncate text-xl font-semibold tabular-nums tracking-tight">{value}</span>
          )}
          {(badge || hint) && !loading && (
            <span className="mt-1 flex items-center gap-2">
              {badge && <Badge variant={badge.variant ?? 'secondary'}>{badge.text}</Badge>}
              {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
