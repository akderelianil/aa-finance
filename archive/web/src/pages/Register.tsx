import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PageShell, FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export default function Register() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setError(errorMessage(t, error))
    else setSentTo(email)
    setBusy(false)
  }

  if (sentTo) {
    return (
      <PageShell>
        <Card>
          <CardHeader>
            <CardTitle>{t('auth.checkEmailTitle')}</CardTitle>
            <CardDescription>{t('auth.checkEmailBody', { email: sentTo })}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" className="w-full" nativeButton={false} render={<Link to="/login" />}>{t('auth.backToLogin')}</Button>
          </CardFooter>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Card>
        <form onSubmit={onSubmit}>
          <CardHeader>
            <CardTitle>{t('auth.register')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>
            </div>
            <FormError message={error} />
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-4">
            <Button type="submit" className="w-full" disabled={busy}>{t('auth.register')}</Button>
            <p className="text-sm text-muted-foreground">
              {t('auth.haveAccount')}{' '}
              <Link to="/login" className="font-medium text-foreground underline">{t('auth.login')}</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </PageShell>
  )
}

