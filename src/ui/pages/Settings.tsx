import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArchiveRestoreIcon, DatabaseBackupIcon, FileJsonIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
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
import { MembersCard } from '@/components/members/MembersCard'
import { LANGUAGES, type Language } from '@/i18n'
import { COUNTRY_CURRENCY } from '../../core/countries.ts'
import { call, useErrorText, useOp, useWrite } from '@/lib/api'
import { backupAs, backupDir, exportJson, inApp, resetAll, restore } from '@/lib/files'
import type { Settings as Values } from '../../core/api/settings.ts'

// Settings: group name, language, period lock date, how long the activity log is kept; backups and export.
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
  const [groupName, setGroupName] = useState(values.groupName)
  const [country, setCountry] = useState(values.country ?? '')
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([i18n.language], { type: 'region' })
    return Object.keys(COUNTRY_CURRENCY)
      .map((c) => ({ value: c, label: names.of(c) ?? c }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language))
  }, [i18n.language])
  const admin = values.me.role === 'admin'
  const save = useWrite('settings.update')
  const daysNumber = Number(days)
  const daysError = !Number.isInteger(daysNumber) || daysNumber < 1 ? t('settings.daysInvalid') : null
  const nameError = !groupName.trim() ? t('settings.nameInvalid') : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (daysError || nameError) return
    save.mutate(
      {
        ...(language !== values.language && { language }),
        ...((lockDate || null) !== values.lockDate && { lockDate: lockDate || null }),
        ...(daysNumber !== values.activityLogDays && { activityLogDays: daysNumber }),
        ...(groupName.trim() !== values.groupName && { groupName: groupName.trim() }),
        ...(country && country !== values.country && { country }),
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
                <FieldLabel htmlFor="set-name">{t('setup.groupName')}</FieldLabel>
                <Input
                  id="set-name" className="max-w-sm" value={groupName} maxLength={200} disabled={!admin}
                  aria-invalid={!!nameError || undefined} onChange={(e) => setGroupName(e.target.value)}
                />
                {(nameError || !admin) && (
                  <FieldDescription className={nameError ? 'text-destructive' : undefined}>{nameError ?? t('members.adminOnly')}</FieldDescription>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="set-language">{t('setup.language')}</FieldLabel>
                  <OptionSelect
                    id="set-language" value={language} onChange={(v) => setLanguage(v as Language)} disabled={!admin}
                    options={LANGUAGES.map((l) => ({ value: l, label: t(`language.${l}`) }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t('settings.theme')}</FieldLabel>
                  <div><ThemeToggle /></div>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="set-country">{t('setup.country')}</FieldLabel>
                <OptionSelect
                  id="set-country" className="max-w-sm" value={country} onChange={setCountry} disabled={!admin}
                  placeholder={t('settings.countryNone')} options={countries}
                />
                <FieldDescription>{t('settings.countryHint')}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="set-lock">{t('settings.lockDate')}</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input id="set-lock" type="date" className="w-44" value={lockDate} disabled={!admin} onChange={(e) => setLockDate(e.target.value)} />
                  {lockDate && admin && <Button type="button" variant="ghost" size="sm" onClick={() => setLockDate('')}>{t('settings.unlock')}</Button>}
                </div>
                <FieldDescription>{t('settings.lockHint')}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="set-days">{t('settings.activityDays')}</FieldLabel>
                <Input
                  id="set-days" inputMode="numeric" className="max-w-28 text-end tabular-nums" value={days} disabled={!admin}
                  aria-invalid={!!daysError || undefined} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))}
                />
                <FieldDescription className={daysError ? 'text-destructive' : undefined}>{daysError ?? t('settings.activityHint')}</FieldDescription>
              </Field>
              {save.error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(save.error)}</AlertDescription></Alert>}
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={save.isPending || !admin}>
              {save.isPending && <Spinner data-icon="inline-start" />}
              {t('common.save')}
            </Button>
          </CardFooter>
        </Card>
      </form>
      <MembersCard admin={admin} />
      <DataCard />
      <DangerCard admin={admin} />
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

// Two destructive actions, admin only; the user types a word to confirm.
type Danger = 'records' | 'delete'

function DangerCard({ admin }: { admin: boolean }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const qc = useQueryClient()
  const [kind, setKind] = useState<Danger | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const word = t('danger.word')
  const ready = typed.trim().toLocaleUpperCase() === word
  const rows: Danger[] = ['records', 'delete']

  async function run() {
    if (!kind || !ready) return
    setBusy(true)
    setError(null)
    try {
      if (kind === 'records') {
        const { count } = await call('entries.deleteAll', {})
        await qc.invalidateQueries()
        setKind(null)
        toast.add({ title: t('danger.recordsDone', { count }), timeout: 4000 })
      } else await resetAll()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('danger.title')}</CardTitle>
        <CardDescription>{admin ? t('danger.hint') : t('danger.adminOnly')}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {rows.map((r) => (
            <div key={r} className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t(`danger.${r}`)}</span>
                <span className="text-xs text-muted-foreground">{t(`danger.${r}Hint`)}</span>
              </div>
              <Button
                variant="destructive" size="sm" className="shrink-0" disabled={!admin}
                onClick={() => { setTyped(''); setError(null); setKind(r) }}
              >
                <Trash2Icon data-icon="inline-start" />
                {t(`danger.${r}`)}
              </Button>
            </div>
          ))}
        </FieldGroup>
      </CardContent>
      <AlertDialog open={kind !== null} onOpenChange={(o) => !busy && !o && setKind(null)}>
        <AlertDialogContent>
          <form onSubmit={(e) => { e.preventDefault(); void run() }} className="flex flex-col gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>{kind && t(`danger.${kind}Title`)}</AlertDialogTitle>
              <AlertDialogDescription>{kind && t(`danger.${kind}Body`)}</AlertDialogDescription>
            </AlertDialogHeader>
            <Field>
              <FieldLabel htmlFor="danger-word">{t('danger.confirm', { word })}</FieldLabel>
              <Input id="danger-word" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
            </Field>
            {error != null && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(error)}</AlertDescription></Alert>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{t('common.cancel')}</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={!ready || busy}>
                {busy && <Spinner data-icon="inline-start" />}
                {kind && t(`danger.${kind}`)}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
