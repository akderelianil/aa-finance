import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const TODAY = new Date().toISOString().slice(0, 10)

type Props = {
  firstName: string
  lastName: string
  birthDate: string
  onFirstName: (v: string) => void
  onLastName: (v: string) => void
  onBirthDate: (v: string) => void
}

export function PersonFields(p: Props) {
  const { t } = useTranslation()
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="first">{t('onboarding.firstName')}</Label>
        <Input id="first" required maxLength={80} autoComplete="given-name" value={p.firstName} onChange={(e) => p.onFirstName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="last">{t('onboarding.lastName')}</Label>
        <Input id="last" required maxLength={80} autoComplete="family-name" value={p.lastName} onChange={(e) => p.onLastName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="birth">{t('onboarding.birthDate')}</Label>
        <Input id="birth" type="date" required min="1900-01-01" max={TODAY} autoComplete="bday" value={p.birthDate} onChange={(e) => p.onBirthDate(e.target.value)} />
      </div>
    </>
  )
}
