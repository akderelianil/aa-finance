import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type Theme = 'light' | 'dark' | 'system'
const KEY = 'theme'

function stored(): Theme {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

// Uygulama açılışında çağrılır (main.tsx): kayıtlı tema, yoksa sistem.
export function initTheme() {
  applyTheme(stored())
}

const ORDER = ['light', 'dark', 'system'] as const
const ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorIcon }

// The current theme, shared by every toggle on screen (the header button and the settings choice).
function useTheme() {
  const [theme, setTheme] = useState<Theme>(stored)
  useEffect(() => {
    const sync = () => setTheme(stored())
    window.addEventListener('themechange', sync)
    return () => window.removeEventListener('themechange', sync)
  }, [])
  function choose(next: Theme) {
    try {
      if (next === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch { /* depolama kapalıysa sadece bu oturumda geçerli */ }
    applyTheme(next)
    setTheme(next)
    window.dispatchEvent(new Event('themechange'))
  }
  return [theme, choose] as const
}

// Settings: the three themes side by side, one always selected.
export function ThemeChoice() {
  const { t } = useTranslation()
  const [theme, choose] = useTheme()
  return (
    <ToggleGroup
      variant="outline" size="sm" spacing={0} value={[theme]} aria-label={t('settings.theme')}
      onValueChange={(v) => { if (v[0]) choose(v[0] as Theme) }}
    >
      {ORDER.map((k) => {
        const Icon = ICONS[k]
        return (
          <ToggleGroupItem key={k} value={k} aria-label={t(`settings.theme_${k}`)} title={t(`settings.theme_${k}`)}>
            <Icon />
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
