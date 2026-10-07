import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

export default function OnboardingChoice() {
  const { t } = useTranslation()
  return (
    <PageShell>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('onboarding.welcome')}</h1>
        <p className="text-muted-foreground">{t('onboarding.choose')}</p>
      </div>
      <Link to="/onboarding/create">
        <Card className="transition hover:bg-accent">
          <CardHeader>
            <CardTitle>{t('onboarding.createGroup')}</CardTitle>
            <CardDescription>{t('onboarding.createGroupDesc')}</CardDescription>
          </CardHeader>
        </Card>
      </Link>
      <Link to="/onboarding/join">
        <Card className="transition hover:bg-accent">
          <CardHeader>
            <CardTitle>{t('onboarding.joinGroup')}</CardTitle>
            <CardDescription>{t('onboarding.joinGroupDesc')}</CardDescription>
          </CardHeader>
        </Card>
      </Link>
      <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>{t('common.logout')}</Button>
    </PageShell>
  )
}
