import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PersonFields } from '@/components/PersonFields'
import { PageShell, FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'

export default function OnboardingJoin() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')

  const join = useMutation({
    mutationFn: () =>
      callFunction('onboarding-join-group', {
        code,
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['membership'] }),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    join.mutate()
  }

  return (
    <PageShell>
      <Card>
        <form onSubmit={onSubmit}>
          <CardHeader>
            <CardTitle>{t('onboarding.joinTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="code">{t('onboarding.inviteCode')}</Label>
              <Input
                id="code" required maxLength={8} autoCapitalize="characters" autoComplete="off"
                className="text-center font-mono text-xl tracking-[0.3em] uppercase"
                value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
            <PersonFields
              firstName={firstName} lastName={lastName} birthDate={birthDate}
              onFirstName={setFirstName} onLastName={setLastName} onBirthDate={setBirthDate}
            />
            <FormError message={join.error ? errorMessage(t, join.error) : null} />
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-4">
            <Button type="submit" className="w-full" disabled={join.isPending}>{t('onboarding.submitJoin')}</Button>
            <Button variant="ghost" className="w-full" nativeButton={false} render={<Link to="/onboarding" />}>{t('common.back')}</Button>
          </CardFooter>
        </form>
      </Card>
    </PageShell>
  )
}

