import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { OptionSelect } from '@/components/OptionSelect'
import { PageHeader } from '@/components/PageHeader'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { DataState } from '@/components/DataState'
import { LANGUAGES, type Language } from '@/i18n'
import { useErrorText, useOp, useWrite } from '@/lib/api'
import type { Settings as Values } from '../../core/api/settings.ts'

// Settings: language, period lock date, how long the activity log is kept. The base currency is fixed at setup.
export default function Settings() {
  const { t } = useTranslation()
  const settings = useOp('settings.get', {})
  return (
    <>
      <PageHeader title={t('nav.settings')} description={t('settings.subtitle')} />
      {settings.data
        ? <SettingsForm key={JSON.stringify(settings.data)} values={settings.data} />
        : <DataState loading={settings.isPending} error={settings.isError} onRetry={() => void settings.refetch()} />}
    </>
  )
}

function SettingsForm({ values }: { values: Values }) {
  const { t, i18n } = useTranslation()
  const errorText = useErrorText()
  const [language, setLanguage] = useState<Language>(values.language)
  const [lockDate, setLockDate] = useState(values.lockDate ?? '')
  const [days, setDays] = useState(String(values.activityLogDays))
  const save = useWrite('settings.update')
  const daysNumber = Number(days)
  const daysError = !Number.isInteger(daysNumber) || daysNumber < 1 ? t('settings.daysInvalid') : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (daysError) return
    save.mutate(
      {
        ...(language !== values.language && { language }),
        ...((lockDate || null) !== values.lockDate && { lockDate: lockDate || null }),
        ...(daysNumber !== values.activityLogDays && { activityLogDays: daysNumber }),
      },
      {
        onSuccess: () => {
          if (language !== i18n.language) void i18n.changeLanguage(language)
          toast.add({ title: t('settings.saved'), timeout: 2500 })
        },
      },
    )
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.book')}</CardTitle>
          <CardDescription>{t('settings.baseCurrency', { currency: values.baseCurrency })}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="set-language">{t('setup.language')}</FieldLabel>
                <OptionSelect
                  id="set-language" value={language} onChange={(v) => setLanguage(v as Language)}
                  options={LANGUAGES.map((l) => ({ value: l, label: t(`language.${l}`) }))}
                />
              </Field>
              <Field>
                <FieldLabel>{t('settings.theme')}</FieldLabel>
                <div><ThemeToggle /></div>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="set-lock">{t('settings.lockDate')}</FieldLabel>
              <div className="flex items-center gap-2">
                <Input id="set-lock" type="date" className="w-44" value={lockDate} onChange={(e) => setLockDate(e.target.value)} />
                {lockDate && <Button type="button" variant="ghost" size="sm" onClick={() => setLockDate('')}>{t('settings.unlock')}</Button>}
              </div>
              <FieldDescription>{t('settings.lockHint')}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="set-days">{t('settings.activityDays')}</FieldLabel>
              <Input
                id="set-days" inputMode="numeric" className="max-w-28 text-end tabular-nums" value={days}
                aria-invalid={!!daysError || undefined} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))}
              />
              <FieldDescription className={daysError ? 'text-destructive' : undefined}>{daysError ?? t('settings.activityHint')}</FieldDescription>
            </Field>
            {save.error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(save.error)}</AlertDescription></Alert>}
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t('common.save')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
