import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LANGUAGES, type Language } from '@/i18n'
import { useErrorText, useOp, useWrite } from '@/lib/api'

// First run: base currency, language, user name, chart template (setup.run).
export default function Setup() {
  const { t, i18n } = useTranslation()
  const errorText = useErrorText()
  const currencies = useOp('currencies.list', {})
  const setup = useWrite('setup.run')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(i18n.language === 'tr' ? 'TRY' : 'EUR')
  const [chart, setChart] = useState<'recommended' | 'core'>('recommended')
  const language = i18n.language as Language

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setup.mutate({ baseCurrency: currency, language, userName: name, recommended: chart === 'recommended' })
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <CardHeader>
            <CardTitle>{t('setup.title')}</CardTitle>
            <CardDescription>{t('setup.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t('setup.name')}</Label>
              <Input id="name" value={name} maxLength={200} required autoFocus onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('setup.language')}</Label>
              <Select value={language} onValueChange={(v) => v && void i18n.changeLanguage(v)}>
                <SelectTrigger className="w-full"><SelectValue>{(v: Language) => t(`language.${v}`)}</SelectValue></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{t(`language.${l}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('setup.baseCurrency')}</Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(currencies.data ?? []).map((c) => <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('setup.baseCurrencyHint')}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('setup.chart')}</Label>
              <RadioGroup value={chart} onValueChange={(v) => setChart(v as 'recommended' | 'core')}>
                {(['recommended', 'core'] as const).map((k) => (
                  <Label key={k} className="items-start gap-3 font-normal">
                    <RadioGroupItem value={k} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{t(k === 'core' ? 'setup.chartCore' : 'setup.chartRecommended')}</span>
                      <span className="text-xs text-muted-foreground">{t(k === 'core' ? 'setup.chartCoreDesc' : 'setup.chartRecommendedDesc')}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
            {setup.error && (
              <Alert variant="destructive" role="alert"><AlertDescription>{errorText(setup.error)}</AlertDescription></Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={setup.isPending}>{t('setup.submit')}</Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
