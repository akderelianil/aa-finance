import { useQuery } from '@tanstack/react-query'
import { ArchiveRestoreIcon, DatabaseBackupIcon, FileJsonIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { OptionSelect } from '@/components/OptionSelect'
import { PageHeader } from '@/components/PageHeader'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Alert, AlertDescription } from '@/components/reui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { DataState } from '@/components/DataState'
import { LANGUAGES, type Language } from '@/i18n'
import { useErrorText, useOp, useWrite } from '@/lib/api'
import { backupAs, backupDir, exportJson, inApp, restore } from '@/lib/files'
import type { Settings as Values } from '../../core/api/settings.ts'

// Settings: profile name, language, period lock date, how long the activity log is kept; backups and export.
// The base currency is fixed at setup.
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
  const [userName, setUserName] = useState(values.userName)
  const save = useWrite('settings.update')
  const daysNumber = Number(days)
  const daysError = !Number.isInteger(daysNumber) || daysNumber < 1 ? t('settings.daysInvalid') : null
  const nameError = !userName.trim() ? t('settings.nameInvalid') : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (daysError || nameError) return
    save.mutate(
      {
        ...(language !== values.language && { language }),
        ...((lockDate || null) !== values.lockDate && { lockDate: lockDate || null }),
        ...(daysNumber !== values.activityLogDays && { activityLogDays: daysNumber }),
        ...(userName.trim() !== values.userName && { userName: userName.trim() }),
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
    <div className="flex max-w-2xl flex-col gap-6">
      <form onSubmit={onSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.book')}</CardTitle>
            <CardDescription>{t('settings.baseCurrency', { currency: values.baseCurrency })}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="set-name">{t('settings.userName')}</FieldLabel>
                <Input
                  id="set-name" className="max-w-sm" value={userName} maxLength={200}
                  aria-invalid={!!nameError || undefined} onChange={(e) => setUserName(e.target.value)}
                />
                <FieldDescription className={nameError ? 'text-destructive' : undefined}>{nameError ?? t('settings.userNameHint')}</FieldDescription>
              </Field>
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
      <DataCard />
    </div>
  )
}

// Backups and export. A restore replaces all data, so it asks first.
function DataCard() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [busy, setBusy] = useState<'backup' | 'restore' | 'export' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const dir = useQuery({ queryKey: ['backup_dir'], queryFn: backupDir, enabled: inApp })

  async function run(kind: NonNullable<typeof busy>, job: () => Promise<unknown>, done?: string) {
    setBusy(kind)
    try {
      const out = await job()
      if (out && done) toast.add({ title: done, description: typeof out === 'string' ? out : undefined, timeout: 4000 })
    } catch (e) {
      toast.add({ title: errorText(e), timeout: 6000 })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('data.title')}</CardTitle>
        <CardDescription>{t('data.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>{t('data.backup')}</FieldLabel>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={!inApp || !!busy} onClick={() => void run('backup', backupAs, t('data.backupDone'))}>
                {busy === 'backup' ? <Spinner data-icon="inline-start" /> : <DatabaseBackupIcon data-icon="inline-start" />}
                {t('data.backupNow')}
              </Button>
              <Button variant="outline" size="sm" disabled={!inApp || !!busy} onClick={() => setConfirming(true)}>
                {busy === 'restore' ? <Spinner data-icon="inline-start" /> : <ArchiveRestoreIcon data-icon="inline-start" />}
                {t('data.restore')}
              </Button>
            </div>
            <FieldDescription>
              {inApp ? t('data.autoHint', { dir: dir.data ?? '…' }) : t('data.appOnly')}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>{t('data.export')}</FieldLabel>
            <div>
              <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void run('export', exportJson, t('data.exportDone'))}>
                {busy === 'export' ? <Spinner data-icon="inline-start" /> : <FileJsonIcon data-icon="inline-start" />}
                {t('data.exportJson')}
              </Button>
            </div>
            <FieldDescription>{t('data.exportHint')}</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('data.restoreTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('data.restoreBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { setConfirming(false); void run('restore', restore) }}>
              {t('data.restoreChoose')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
