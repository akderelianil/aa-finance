import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { PersonFields } from '@/components/PersonFields'
import { PageShell, FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export default function OnboardingCreate() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [currency, setCurrency] = useState('TRY')
  const [groupName, setGroupName] = useState('')
  const [chart, setChart] = useState<'recommended' | 'core'>('recommended')

  const currencies = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('currencies').select('code, name').order('code')
      if (error) throw error
      return data
    },
  })

  const create = useMutation({
    mutationFn: () =>
      callFunction('onboarding-create-group', {
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate,
        base_currency: currency,
        chart,
        group_name: groupName.trim() || t('onboarding.defaultGroupName', { lastName: lastName.trim() }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['membership'] }),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    create.mutate()
  }

  return (
    <PageShell>
      <Card>
        <form onSubmit={onSubmit}>
          <CardHeader>
            <CardTitle>{t('onboarding.createTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <PersonFields
              firstName={firstName} lastName={lastName} birthDate={birthDate}
              onFirstName={setFirstName} onLastName={setLastName} onBirthDate={setBirthDate}
            />
            <div className="flex flex-col gap-2">
              <Label>{t('onboarding.currency')}</Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(currencies.data ?? [{ code: 'TRY', name: 'TRY' }]).map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="group">{t('onboarding.groupName')}</Label>
              <Input id="group" value={groupName} maxLength={100} onChange={(e) => setGroupName(e.target.value)} />
              {lastName.trim() && (
                <p className="text-xs text-muted-foreground">
                  {t('onboarding.groupNameHint', { name: t('onboarding.defaultGroupName', { lastName: lastName.trim() }) })}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('onboarding.chart')}</Label>
              <RadioGroup value={chart} onValueChange={(v) => setChart(v as 'recommended' | 'core')}>
                {(['recommended', 'core'] as const).map((k) => (
                  <Label key={k} className="items-start gap-3 font-normal">
                    <RadioGroupItem value={k} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{t(k === 'core' ? 'onboarding.chartCore' : 'onboarding.chartRecommended')}</span>
                      <span className="text-xs text-muted-foreground">{t(k === 'core' ? 'onboarding.chartCoreDesc' : 'onboarding.chartRecommendedDesc')}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
            <FormError message={create.error ? errorMessage(t, create.error) : null} />
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-4">
            <Button type="submit" className="w-full" disabled={create.isPending}>{t('onboarding.submitCreate')}</Button>
            <Button variant="ghost" className="w-full" nativeButton={false} render={<Link to="/onboarding" />}>{t('common.back')}</Button>
          </CardFooter>
        </form>
      </Card>
    </PageShell>
  )
}


