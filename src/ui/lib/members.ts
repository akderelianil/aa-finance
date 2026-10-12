// Profile colors: a core color name → avatar classes. Categorical identity, so raw palette with its dark pair.
export const MEMBER_COLOR_CLASS: Record<string, string> = {
  blue: 'bg-blue-500 dark:bg-blue-400',
  emerald: 'bg-emerald-500 dark:bg-emerald-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  rose: 'bg-rose-500 dark:bg-rose-400',
  violet: 'bg-violet-500 dark:bg-violet-400',
  cyan: 'bg-cyan-500 dark:bg-cyan-400',
  orange: 'bg-orange-500 dark:bg-orange-400',
  lime: 'bg-lime-500 dark:bg-lime-400',
}

export const colorClass = (color: string | null) => MEMBER_COLOR_CLASS[color ?? 'blue'] ?? MEMBER_COLOR_CLASS.blue

/** Up to two initials. */
export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toLocaleUpperCase() ?? '').join('')
