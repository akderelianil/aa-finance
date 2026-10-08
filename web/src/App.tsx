import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { useMembership } from '@/auth/useMembership'
import { AppShell } from '@/components/AppShell'
import { PageShell } from '@/components/PageShell'
import Journal from '@/pages/Journal'
import Calendar from '@/pages/Calendar'
import Settings from '@/pages/Settings'
import Login from '@/pages/Login'
import OnboardingChoice from '@/pages/OnboardingChoice'
import OnboardingCreate from '@/pages/OnboardingCreate'
import OnboardingJoin from '@/pages/OnboardingJoin'
import Register from '@/pages/Register'

// Hidden flows (old Home, Installments, Investments, Setup) keep their pages but have no route.
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Accounts = lazy(() => import('@/pages/Accounts'))
const AccountRegister = lazy(() => import('@/pages/AccountRegister'))
const Reports = lazy(() => import('@/pages/Reports'))
const Directory = lazy(() => import('@/pages/Directory'))

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
        <Route path="/anasayfa" element={<Dashboard membership={membership.data} />} />
        <Route path="/hesaplar" element={<Accounts membership={membership.data} />} />
        <Route path="/hesaplar/:id" element={<AccountRegister membership={membership.data} />} />
        <Route path="/yevmiye" element={<Journal membership={membership.data} />} />
        <Route path="/raporlar" element={<Reports membership={membership.data} />} />
        <Route path="/rehber" element={<Directory membership={membership.data} />} />
        <Route path="/takvim" element={<Calendar />} />
        <Route path="/ayarlar" element={<Settings membership={membership.data} />} />
      </Route>
      <Route path="*" element={<Navigate to="/anasayfa" replace />} />
    </Routes>
    </Suspense>
  )
}
