import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { useMembership } from '@/auth/useMembership'
import { PageShell } from '@/components/PageShell'
import Accounts from '@/pages/Accounts'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import People from '@/pages/People'
import OnboardingChoice from '@/pages/OnboardingChoice'
import OnboardingCreate from '@/pages/OnboardingCreate'
import OnboardingJoin from '@/pages/OnboardingJoin'
import Register from '@/pages/Register'

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
    <Routes>
      <Route path="/" element={<Home membership={membership.data} />} />
      <Route path="/accounts" element={<Accounts membership={membership.data} />} />
      <Route path="/people" element={<People membership={membership.data} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
