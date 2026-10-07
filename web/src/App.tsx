import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { useMembership } from '@/auth/useMembership'
import { AppShell } from '@/components/AppShell'
import { PageShell } from '@/components/PageShell'
import Home from '@/pages/Home'
import Journal from '@/pages/Journal'
import Settings from '@/pages/Settings'
import Login from '@/pages/Login'
import OnboardingChoice from '@/pages/OnboardingChoice'
import OnboardingCreate from '@/pages/OnboardingCreate'
import OnboardingJoin from '@/pages/OnboardingJoin'
import Register from '@/pages/Register'

const Accounts = lazy(() => import('@/pages/Accounts'))
const Directory = lazy(() => import('@/pages/Directory'))
const Installments = lazy(() => import('@/pages/Installments'))
const Investments = lazy(() => import('@/pages/Investments'))
const Reports = lazy(() => import('@/pages/Reports'))
const Setup = lazy(() => import('@/pages/Setup'))

function Loading() {
  const { t } = useTranslation()
  return <PageShell><p className="text-center text-muted-foreground">{t('common.loading')}</p></PageShell>
}

// Durum: giriş yok → login/register; giriş var ama grup yok → onboarding; grup var → uygulama.
export default function App() {
  const { session, loading } = useAuth()
  const membership = useMembership(session?.user.id)

  if (loading || (session && membership.isLoading)) return <Loading />

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!membership.data) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingChoice />} />
        <Route path="/onboarding/create" element={<OnboardingCreate />} />
        <Route path="/onboarding/join" element={<OnboardingJoin />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    )
  }

  return (
    <Suspense fallback={<Loading />}>
    <Routes>
      <Route element={<AppShell membership={membership.data} />}>
        <Route path="/" element={<Home membership={membership.data} />} />
        <Route path="/islemler" element={<Journal membership={membership.data} />} />
        <Route path="/hesaplar" element={<Accounts membership={membership.data} />} />
        <Route path="/raporlar" element={<Reports membership={membership.data} />} />
        <Route path="/ayarlar" element={<Settings membership={membership.data} />} />
        <Route path="/rehber" element={<Directory membership={membership.data} />} />
        <Route path="/ayarlar/kisiler" element={<Navigate to="/rehber" replace />} />
        <Route path="/ayarlar/taksitler" element={<Installments membership={membership.data} />} />
        <Route path="/ayarlar/yatirimlar" element={<Investments membership={membership.data} />} />
      </Route>
      <Route path="/baslangic" element={<Setup membership={membership.data} />} />
      {/* Grup kurulunca / gruba katılınca adres hâlâ /onboarding/...: başlangıç sihirbazına geç. */}
      <Route path="/onboarding/*" element={<Navigate to="/baslangic" replace />} />
      <Route path="/accounts" element={<Navigate to="/hesaplar" replace />} />
      <Route path="/reports" element={<Navigate to="/raporlar" replace />} />
      <Route path="/people" element={<Navigate to="/rehber" replace />} />
      <Route path="/installments" element={<Navigate to="/ayarlar/taksitler" replace />} />
      <Route path="/investments" element={<Navigate to="/ayarlar/yatirimlar" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}
