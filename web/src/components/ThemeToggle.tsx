import { useState } from 'react'
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

export function ThemeToggle() {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<Theme>(stored)

  function change(v: string[]) {
    const next = (v[0] as Theme | undefined) ?? theme
    setTheme(next)
    try {
      if (next === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch { /* depolama kapalıysa sadece bu oturumda geçerli */ }
    applyTheme(next)
  }

  return (
    <ToggleGroup value={[theme]} onValueChange={change} spacing={2} aria-label={t('settings.theme')}>
      {(['light', 'dark', 'system'] as const).map((k) => (
        <ToggleGroupItem key={k} value={k} variant="outline">{t(`settings.theme_${k}`)}</ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
