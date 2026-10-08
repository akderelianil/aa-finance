import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

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

export function ThemeToggle() {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<Theme>(stored)

  const order = ['light', 'dark', 'system'] as const
  const Icon = { light: SunIcon, dark: MoonIcon, system: MonitorIcon }[theme]

  function cycle() {
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
    try {
      if (next === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch { /* depolama kapalıysa sadece bu oturumda geçerli */ }
    applyTheme(next)
  }

  return (
    <Button type="button" variant="outline" size="icon" onClick={cycle} aria-label={`${t('settings.theme')}: ${t(`settings.theme_${theme}`)}`} title={t(`settings.theme_${theme}`)}>
      <Icon />
    </Button>
  )
}
