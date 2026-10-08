import type { ReactNode } from 'react'
import { Area, AreaChart } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer } from '@/components/ui/chart'
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
  spark?: { values: number[]; color: string }
}

// One figure: label, large value, optional hint. Colour marks the sign of the value only.
export function Stat({ label, value, tone = 'neutral', loading, hint, badge, spark }: StatProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 first:pl-0 last:pr-0">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      {loading ? <Skeleton className="h-8 w-32" /> : (
        <span className={cn('truncate text-2xl font-semibold tabular-nums tracking-tight', TONE[tone])}>{value}</span>
      )}
      {!loading && spark && <Sparkline {...spark} />}
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

// Six-point trend line under a figure. No axes: the number above is the value, the line shows direction.
function Sparkline({ values, color }: { values: number[]; color: string }) {
  return (
    <ChartContainer config={{ v: { color } }} className="h-10 w-full" aria-hidden>
      <AreaChart data={values.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <Area dataKey="v" type="monotone" stroke="var(--color-v)" fill="var(--color-v)" fillOpacity={0.12} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  )
}

export type Segment = { key: string; label: string; value: number; color: string }

// One horizontal bar split into shares, with a legend. For "what is the whole made of" (assets = debt + net worth).
export function CompositionBar({ segments, format }: { segments: Segment[]; format: (v: number) => string }) {
  const total = segments.reduce((s, x) => s + Math.max(x.value, 0), 0)
  if (total <= 0) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={segments.map((x) => `${x.label} ${format(x.value)}`).join(', ')}>
        {segments.filter((x) => x.value > 0).map((x) => (
          <div key={x.key} style={{ width: `${(x.value / total) * 100}%`, background: x.color }} />
        ))}
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        {segments.filter((x) => x.value > 0).map((x) => (
          <span key={x.key} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: x.color }} />
            {x.label}
            <span className="tabular-nums text-foreground">{Math.round((x.value / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}
