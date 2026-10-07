import { useTranslation } from 'react-i18next'
import { LANGUAGES } from '@/i18n'
import { Button } from '@/components/ui/button'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const current = i18n.resolvedLanguage
  return (
    <div className="flex gap-1">
      {LANGUAGES.map((lng) => (
        <Button
          key={lng}
          type="button"
          size="sm"
          variant={current === lng ? 'default' : 'ghost'}
          onClick={() => void i18n.changeLanguage(lng)}
        >
          {lng.toUpperCase()}
        </Button>
      ))}
    </div>
  )
}
