import { lazy, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { DataState } from '@/components/DataState'
import { ApiError, useOp } from '@/lib/api'
import { autoBackup } from '@/lib/files'
import Setup from '@/pages/Setup'

// Pages load on first visit: a smaller first bundle.
const Accounts = lazy(() => import('@/pages/Accounts'))
const AccountRegister = lazy(() => import('@/pages/AccountRegister'))
const Journal = lazy(() => import('@/pages/Journal'))
const Reports = lazy(() => import('@/pages/Reports'))
const Rates = lazy(() => import('@/pages/Rates'))
const Settings = lazy(() => import('@/pages/Settings'))
const Activity = lazy(() => import('@/pages/Activity'))

// Not set up → Setup; set up → the app in the saved language.
export default function App() {
  const { i18n } = useTranslation()
  const settings = useOp('settings.get', {})
  const language = settings.data?.language

  useEffect(() => {
    if (language && i18n.language !== language) void i18n.changeLanguage(language)
  }, [language, i18n])

  // Once the book is set up: today's automatic backup (a failure must not stop the app).
  const ready = !!settings.data
  useEffect(() => {
    if (ready) autoBackup().catch((e) => console.error('auto backup', e))
  }, [ready])

  if (settings.error instanceof ApiError && settings.error.code === 'not_setup') return <Setup />
  if (!settings.data) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <DataState loading={settings.isPending} error={settings.isError} onRetry={() => void settings.refetch()} />
      </main>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/hesaplar" element={<Accounts />} />
        <Route path="/hesaplar/:uid" element={<AccountRegister />} />
        <Route path="/yevmiye" element={<Journal />} />
        <Route path="/raporlar" element={<Reports />} />
        <Route path="/kurlar" element={<Rates />} />
        <Route path="/ayarlar" element={<Settings />} />
        <Route path="/etkinlik" element={<Activity />} />
      </Route>
      <Route path="*" element={<Navigate to="/hesaplar" replace />} />
    </Routes>
  )
}
