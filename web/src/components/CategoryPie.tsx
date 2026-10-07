import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { sliceColor, type Slice } from '@/lib/chart'

type Props = {
  title: string
  description: string
  icon: LucideIcon
  slices: Slice[]
  empty: string
  loading?: boolean
  money: (v: number) => string
}

// Halka grafik + yüzdeli açıklama listesi.
export function CategoryPie({ title, description, icon: Icon, slices, empty, loading, money }: Props) {
  const { i18n } = useTranslation()
  const total = slices.reduce((s, x) => s + x.value, 0)
  const config: ChartConfig = Object.fromEntries(slices.map((s, i) => [s.name, { label: s.name, color: sliceColor(s, i) }]))
  const pct = new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 0 })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" aria-hidden />{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-44 w-full" />
        ) : slices.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ChartContainer config={config} className="size-44 shrink-0">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="name" formatter={(v) => money(Number(v))} />} />
                <Pie data={slices} dataKey="value" nameKey="name" innerRadius={50} strokeWidth={2} paddingAngle={2}>
                  {slices.map((s, i) => <Cell key={s.name} fill={sliceColor(s, i)} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="flex w-full flex-col gap-2 text-sm">
              {slices.map((s, i) => (
                <li key={s.name} className="flex items-center gap-2">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: sliceColor(s, i) }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{pct.format(s.value / total)}</span>
                  <span className="w-24 text-right font-medium tabular-nums">{money(s.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
