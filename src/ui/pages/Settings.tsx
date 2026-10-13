import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArchiveRestoreIcon, BookOpenIcon, DatabaseBackupIcon, DatabaseIcon, InfoIcon, TriangleAlertIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { OptionCombobox } from '@/components/OptionCombobox'
import { OptionSelect } from '@/components/OptionSelect'
import { PageHeader } from '@/components/PageHeader'
import { ThemeChoice } from '@/components/ThemeToggle'
import { Alert, AlertDescription } from '@/components/reui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Frame, FrameFooter, FrameHeader, FramePanel, FrameTitle, FrameDescription } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { DataState } from '@/components/DataState'
import { SettingRow } from '@/components/SettingRow'
import { MembersCard } from '@/components/members/MembersCard'
import { LANGUAGES, type Language } from '@/i18n'
import { COUNTRY_CURRENCY } from '../../core/countries.ts'
import { currencySymbol } from '@/lib/amount'
import { call, useErrorText, useOp, useWrite } from '@/lib/api'
import { backupAs, backupDir, inApp, resetAll, restore } from '@/lib/files'
import type { Settings as Values } from '../../core/api/settings.ts'

// Settings: group name, language, period lock date, how long the activity log is kept; backup and restore.
// The base currency is fixed at setup.
const SECTIONS = [
  { key: 'book', icon: BookOpenIcon },
  { key: 'members', icon: UsersIcon },
  { key: 'data', icon: DatabaseIcon },
  { key: 'danger', icon: TriangleAlertIcon },
] as const
type Section = (typeof SECTIONS)[number]['key']

export default function Settings() {
  const { t } = useTranslation()
  const settings = useOp('settings.get', {})
  const [section, setSection] = useState<Section>('book')
  const admin = settings.data?.me.role === 'admin'
  return (
    <>
      <PageHeader title={t('nav.settings')} description={t('settings.subtitle')} />
      {settings.data ? (
        <Tabs value={section} onValueChange={(v) => setSection(v as Section)} orientation="vertical" className="gap-8">
          <TabsList variant="line" className="w-48 shrink-0 items-stretch">
            {SECTIONS.map(({ key, icon: Icon }) => (
              <TabsTrigger key={key} value={key} className="h-8 flex-none justify-start gap-2 px-2">
                <Icon />
                {t(`settings.section_${key}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="min-w-0 max-w-3xl flex-1">
            <TabsContent value="book"><SettingsForm key={JSON.stringify(settings.data)} values={settings.data} /></TabsContent>
            <TabsContent value="members"><MembersCard admin={admin} /></TabsContent>
            <TabsContent value="data"><DataCard /></TabsContent>
            <TabsContent value="danger"><DangerCard admin={admin} /></TabsContent>
          </div>
        </Tabs>
      ) : (
        <DataState loading={settings.isPending} error={settings.isError} onRetry={() => void settings.refetch()} />
      )}
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
    <form onSubmit={onSubmit}>
      <Frame>
        <FramePanel className="p-0">
          <FrameHeader className="border-b">
            <FrameTitle>{t('settings.book')}</FrameTitle>
          </FrameHeader>
          <div className="flex flex-col divide-y">
            <SettingRow
              title={<span className="inline-flex items-center gap-1.5">
                {t('settings.baseCurrencyTitle')}
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex text-muted-foreground" aria-label={t('settings.baseCurrencyInfo')} />}>
                    <InfoIcon className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>{t('settings.baseCurrencyInfo')}</TooltipContent>
                </Tooltip>
              </span>}
            >
              <span className="text-sm font-medium tabular-nums">{currencySymbol(values.baseCurrency)} <span className="text-muted-foreground">{values.baseCurrency}</span></span>
            </SettingRow>
            <SettingRow title={t('setup.groupName')} htmlFor="set-name" description={nameError ?? (admin ? undefined : t('members.adminOnly'))} invalid={!!nameError}>
              <Input
                id="set-name" className="w-64" value={groupName} maxLength={200} disabled={!admin}
                aria-invalid={!!nameError || undefined} onChange={(e) => setGroupName(e.target.value)}
              />
            </SettingRow>
            <SettingRow title={t('setup.country')} htmlFor="set-country" description={t('settings.countryHint')}>
              <OptionCombobox
                id="set-country" className="w-64" value={country} onChange={setCountry} disabled={!admin}
                placeholder={t('settings.countryNone')} options={countries}
              />
            </SettingRow>
            <SettingRow title={t('setup.language')} htmlFor="set-language">
              <OptionSelect
                id="set-language" className="w-64" value={language} onChange={(v) => setLanguage(v as Language)} disabled={!admin}
                options={LANGUAGES.map((l) => ({ value: l, label: t(`language.${l}`) }))}
              />
            </SettingRow>
            <SettingRow title={t('settings.theme')}><ThemeChoice /></SettingRow>
            <SettingRow title={t('settings.lockDate')} htmlFor="set-lock" description={t('settings.lockHint')}>
              {lockDate && admin && <Button type="button" variant="ghost" size="sm" onClick={() => setLockDate('')}>{t('settings.unlock')}</Button>}
              <Input id="set-lock" type="date" className="w-44" value={lockDate} disabled={!admin} onChange={(e) => setLockDate(e.target.value)} />
            </SettingRow>
            <SettingRow title={t('settings.activityDays')} htmlFor="set-days" description={daysError ?? t('settings.activityHint')} invalid={!!daysError}>
              <Input
                id="set-days" inputMode="numeric" className="w-28 text-end tabular-nums" value={days} disabled={!admin}
                aria-invalid={!!daysError || undefined} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))}
              />
            </SettingRow>
          </div>
          {save.error && (
            <div className="border-t p-4">
              <Alert variant="destructive" role="alert"><AlertDescription>{errorText(save.error)}</AlertDescription></Alert>
            </div>
          )}
          <FrameFooter className="flex-row justify-end border-t">
            <Button type="submit" size="sm" disabled={save.isPending || !admin}>
              {save.isPending && <Spinner data-icon="inline-start" />}
              {t('common.save')}
            </Button>
          </FrameFooter>
        </FramePanel>
      </Frame>
    </form>
  )
}

// Backup and restore. A restore replaces all data, so it asks first.
function DataCard() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
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
    <Frame>
      <FramePanel className="p-0">
        <FrameHeader className="border-b">
          <FrameTitle>{t('data.title')}</FrameTitle>
          <FrameDescription>{t('data.subtitle')}</FrameDescription>
        </FrameHeader>
        <div className="flex flex-col divide-y">
          <SettingRow title={t('data.backupNow')} description={t('data.backupHint')}>
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void run('backup', backupAs, t('data.backupDone'))}>
              {busy === 'backup' ? <Spinner data-icon="inline-start" /> : <DatabaseBackupIcon data-icon="inline-start" />}
              {t('data.backupNow')}
            </Button>
          </SettingRow>
          <SettingRow title={t('data.restore')} description={t('data.restoreHint')}>
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => setConfirming(true)}>
              {busy === 'restore' ? <Spinner data-icon="inline-start" /> : <ArchiveRestoreIcon data-icon="inline-start" />}
              {t('data.restore')}
            </Button>
          </SettingRow>
        </div>
        {inApp && (
          <FrameFooter className="border-t">
            <p className="text-xs text-muted-foreground">{t('data.autoHint', { dir: dir.data ?? '…' })}</p>
          </FrameFooter>
        )}
      </FramePanel>
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
    </Frame>
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
    <Frame>
      <FramePanel className="p-0">
        <FrameHeader className="border-b">
          <FrameTitle>{t('danger.title')}</FrameTitle>
          <FrameDescription>{admin ? t('danger.hint') : t('danger.adminOnly')}</FrameDescription>
        </FrameHeader>
        <div className="flex flex-col divide-y">
          {rows.map((r) => (
            <SettingRow key={r} title={t(`danger.${r}`)} description={t(`danger.${r}Hint`)}>
              <Button
                variant="destructive" size="sm" disabled={!admin}
                onClick={() => { setTyped(''); setError(null); setKind(r) }}
              >
                <Trash2Icon data-icon="inline-start" />
                {t(`danger.${r}`)}
              </Button>
            </SettingRow>
          ))}
        </div>
      </FramePanel>
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
    </Frame>
  )
}
