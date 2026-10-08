import { useTranslation } from 'react-i18next'
import { Flag } from '@/components/Flag'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { LANGUAGES } from '@/i18n'

const NAMES = { tr: 'Türkçe', en: 'English' } as const

function Label({ lng }: { lng: 'tr' | 'en' }) {
  return <span className="flex items-center gap-2"><Flag lng={lng} />{NAMES[lng]}</span>
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = (i18n.resolvedLanguage ?? 'tr') as 'tr' | 'en'
  return (
    <Select value={current} onValueChange={(v) => void i18n.changeLanguage(v as string)}>
      <SelectTrigger size="sm" aria-label={t('settings.language')}><Label lng={current} /></SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((lng) => (
          <SelectItem key={lng} value={lng}><Label lng={lng} /></SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
