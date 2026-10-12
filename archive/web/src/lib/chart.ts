// Pasta/çubuk grafik renkleri (index.css --chart-*). Sekizinci renk "Diğer" için nötrdür.
export const CHART_COLORS = [1, 2, 3, 4, 5, 6, 7].map((n) => `var(--chart-${n})`)
export const OTHER_COLOR = 'var(--chart-8)'

export type Slice = { name: string; value: number; other?: boolean }

// En büyük N dilim + kalanı "Diğer".
export function topSlices(items: { name: string; value: number }[], n: number, otherLabel: string): Slice[] {
  const sorted = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
  const top: Slice[] = sorted.slice(0, n)
  const rest = sorted.slice(n).reduce((s, x) => s + x.value, 0)
  if (rest > 0) top.push({ name: otherLabel, value: rest, other: true })
  return top
}

export const sliceColor = (s: Slice, i: number) => (s.other ? OTHER_COLOR : CHART_COLORS[i % CHART_COLORS.length])
