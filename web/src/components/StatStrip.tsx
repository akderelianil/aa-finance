import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type Tone = 'neutral' | 'success' | 'danger'

const TONE: Record<Tone, string> = { neutral: '', success: 'text-success', danger: 'text-destructive' }

type StatProps = {
  label: string
  value: string
  tone?: Tone
  loading?: boolean
  hint?: string
  badge?: { text: string; variant: 'success' | 'destructive' | 'secondary' }
}

// One figure: label, large value, optional hint. Colour marks the sign of the value only.
export function Stat({ label, value, tone = 'neutral', loading, hint, badge }: StatProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 first:pl-0 last:pr-0">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      {loading ? <Skeleton className="h-8 w-32" /> : (
        <span className={cn('truncate text-2xl font-semibold tabular-nums tracking-tight', TONE[tone])}>{value}</span>
      )}
      {!loading && (badge || hint) && (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {badge && <Badge variant={badge.variant}>{badge.text}</Badge>}
          {hint && <span className="truncate">{hint}</span>}
        </span>
      )}
    </div>
  )
}

// Card that groups three related figures, separated by 1px dividers.
export function StatStrip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-3 divide-x">{children}</CardContent>
    </Card>
  )
}
