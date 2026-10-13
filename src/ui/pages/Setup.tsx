import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, CircleCheckIcon, CoinsIcon, GlobeIcon, ListTreeIcon, UserRoundIcon, UsersIcon, XIcon, type LucideIcon } from 'lucide-react'
import { COUNTRY_CURRENCY, countryLanguage } from '../../core/countries.ts'
import { recommendedAccounts } from '../../core/chart.ts'
import { MEMBER_COLORS } from '../../core/setup.ts'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { Stepper, StepperIndicator, StepperItem, StepperNav, StepperPanel, StepperContent, StepperTitle, StepperTrigger } from '@/components/reui/stepper'
import { MemberAvatar } from '@/components/members/MemberAvatar'
import { SearchList } from '@/components/SearchList'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'
import { LANGUAGES, type Language } from '@/i18n'
import { call, setMember, useErrorText, useOp } from '@/lib/api'
import { colorClass } from '@/lib/members'
import { cn } from '@/lib/utils'

const STEPS = ['country', 'currency', 'you', 'group', 'chart', 'summary'] as const
const ICONS: Record<(typeof STEPS)[number], LucideIcon> = {
  country: GlobeIcon, currency: CoinsIcon, you: UserRoundIcon, group: UsersIcon, chart: ListTreeIcon, summary: CircleCheckIcon,
}
const DONE_MS = 900

const norm = (s: string) => s.trim().toLocaleLowerCase()
const lastWord = (s: string) => s.trim().split(/\s+/).at(-1) ?? ''

function osCountry(): string | null {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    return region && region in COUNTRY_CURRENCY ? region : null
  } catch {
    return null
  }
}

// First run: six steps, keyboard first, saved once at the end (setup.run). Flow: docs/product-designer/ux/kurulum.md.
export default function Setup({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const errorText = useErrorText()
  const currencies = useOp('currencies.list', {})

  const [step, setStep] = useState(1)
  const [reached, setReached] = useState(1)
  const [back, setBack] = useState(false)
  const [tried, setTried] = useState(false)

  const initial = useRef(osCountry()).current
  const [country, setCountry] = useState<string | null>(initial)
  const [language, setLanguage] = useState<Language>(i18n.language as Language)
  const [currency, setCurrency] = useState<string | null>(null)
  const touched = useRef({ language: false, currency: false })
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(MEMBER_COLORS[0])
  const [groupName, setGroupName] = useState<string | null>(null)
  const [members, setMembers] = useState<string[]>([''])
  const [recommended, setRecommended] = useState(true)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState<unknown>(null)
  const [done, setDone] = useState(false)
  const memberInputs = useRef<(HTMLInputElement | null)[]>([])

  const group = groupName ?? (lastWord(name) ? t('setup.groupSuggest', { name: lastWord(name) }) : '')
  const memberNames = members.map((m) => m.trim()).filter(Boolean)
  const memberErrors = members.map((m, i) =>
    m.trim() && (norm(m) === norm(name) || members.slice(0, i).some((o) => norm(o) === norm(m))) ? t('setup.nameTaken') : null)

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([i18n.language], { type: 'region' })
    return Object.keys(COUNTRY_CURRENCY)
      .map((c) => ({ value: c, label: names.of(c) ?? c, hint: COUNTRY_CURRENCY[c] }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.language))
  }, [i18n.language])
  const currencyItems = useMemo(() => {
    const names = new Intl.DisplayNames([i18n.language], { type: 'currency' })
    return (currencies.data ?? []).map((c) => ({ value: c.code, label: names.of(c.code) ?? c.name, hint: c.code }))
  }, [currencies.data, i18n.language])

  function pickLanguage(l: Language, byHand: boolean) {
    if (byHand) touched.current.language = true
    setLanguage(l)
    void i18n.changeLanguage(l)
  }

  // Country defaults apply when step 1 is left, so the list does not change language while you type.
  function applyCountry() {
    if (!country) return
    if (!touched.current.language) pickLanguage(countryLanguage(country), false)
    if (!touched.current.currency) setCurrency(COUNTRY_CURRENCY[country])
  }

  const valid = (s: number) =>
    s === 1 ? !!country
    : s === 2 ? !!currency
    : s === 3 ? !!name.trim()
    : s === 4 ? !!group.trim() && memberErrors.every((e) => !e)
    : true

  function go(to: number) {
    if (step === 1 && to > 1) applyCountry()
    setBack(to < step)
    setTried(false)
    setStep(to)
    setReached((r) => Math.max(r, to))
  }

  function next() {
    if (!valid(step)) return setTried(true)
    if (step < STEPS.length) go(step + 1)
    else void submit()
  }

  async function submit() {
    if (saving || done) return
    setSaving(true)
    setFailed(null)
    try {
      const { user } = await call('setup.run', {
        baseCurrency: currency!, language, userName: name.trim(), recommended,
        country: country ?? undefined, groupName: group.trim(), color, members: memberNames,
      })
      setDone(true)
      setMember(user)
      setTimeout(() => {
        void qc.invalidateQueries()
        onFinish()
      }, DONE_MS)
    } catch (e) {
      setFailed(e)
    } finally {
      setSaving(false)
    }
  }

  // Enter: next. Esc or Alt+←: back. On the window, so it works wherever focus is.
  // Fields that own Enter or Esc stop the event first.
  function onKeyDown(e: globalThis.KeyboardEvent) {
    const el = e.target as HTMLElement
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !(el.tagName === 'BUTTON' && el.getAttribute('role') !== 'radio')) {
      e.preventDefault()
      next()
    } else if (e.key === 'Escape' || (e.altKey && e.key === 'ArrowLeft')) {
      e.preventDefault()
      if (step > 1) go(step - 1)
      else onBack()
    } else if (step === 5 && /^[1-2]$/.test(e.key) && el.tagName !== 'INPUT') {
      setRecommended(e.key === '2')
      content.current?.querySelectorAll<HTMLElement>('[role=radio]')[Number(e.key) - 1]?.focus()
    }
  }

  const keys = useRef(onKeyDown)
  keys.current = onKeyDown
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => keys.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Each step starts on its first field.
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    content.current?.querySelector<HTMLElement>('[data-first]')?.focus()
  }, [step])

  function onMemberKey(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== 'Enter' || !members[i].trim()) return
    e.preventDefault()
    e.stopPropagation()
    if (memberErrors[i]) return
    if (i === members.length - 1) setMembers([...members, ''])
    setTimeout(() => memberInputs.current[i + 1]?.focus())
  }

  const key = STEPS[step - 1]
  const Icon = ICONS[key]
  const sample = recommendedAccounts.filter((a) => !a.placeholder).slice(0, 6).map((a) => a[language]).join(', ')

  if (done) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div role="status" className="flex flex-col items-center gap-3 animate-in fade-in-0 zoom-in-95 duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]">
          <CircleCheckIcon aria-hidden className="size-12 text-primary" />
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-xl font-semibold tracking-tight">{t('setup.done')}</p>
            <p className="text-sm text-muted-foreground">{t('setup.doneDesc')}</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 pt-[12vh] pb-8">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          {t('welcome.back')}
        </Button>
      </div>
      <Stepper value={step} onValueChange={(s) => s <= reached && go(s)} className="flex flex-col gap-6">
        <StepperNav className="gap-3">
          {STEPS.map((s, i) => (
            <StepperItem key={s} step={i + 1} disabled={i + 1 > reached} completed={i + 1 < step} className="relative flex-1 items-start">
              <StepperTrigger className="flex grow flex-col items-start justify-center gap-2" tabIndex={-1}>
                <StepperIndicator className="h-1 w-full rounded-full bg-border data-[state=active]:bg-primary data-[state=completed]:bg-primary">
                  <span className="sr-only">{i + 1}</span>
                </StepperIndicator>
                <StepperTitle className="text-start text-xs font-medium group-data-[state=inactive]/step:text-muted-foreground">
                  {t(`setup.steps.${s}`)}
                </StepperTitle>
              </StepperTrigger>
            </StepperItem>
          ))}
        </StepperNav>

        <StepperPanel>
          <StepperContent value={step}>
            <Card>
              <div
                key={step}
                ref={content}
                className={cn(
                  'flex flex-col gap-6 animate-in fade-in-0 duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:slide-in-from-left-0 motion-reduce:slide-in-from-right-0',
                  back ? 'slide-in-from-left-2' : 'slide-in-from-right-2',
                )}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon aria-hidden className="size-6 shrink-0 text-primary" />
                    <div className="flex flex-col gap-0.5">
                      <CardTitle className="tracking-tight">{t(`setup.${key}Title`)}</CardTitle>
                      <CardDescription>{t(`setup.${key}Desc`)}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {step === 1 && (
                    <SearchList
                      id="country" items={countries} value={country} onChange={setCountry} onEnter={next} first
                      placeholder={t('setup.countrySearch')} empty={t('setup.noMatch')}
                    />
                  )}

                  {step === 2 && (
                    <>
                      <Field>
                        <FieldLabel id="lang-label">{t('setup.language')}</FieldLabel>
                        <RadioGroup aria-labelledby="lang-label" value={language} onValueChange={(v) => pickLanguage(v as Language, true)} className="flex gap-6">
                          {LANGUAGES.map((l) => (
                            <Label key={l} className="gap-2 font-normal">
                              <RadioGroupItem value={l} data-first={l === language || undefined} />
                              {t(`language.${l}`)}
                            </Label>
                          ))}
                        </RadioGroup>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="currency">{t('setup.baseCurrency')}</FieldLabel>
                        <SearchList
                          id="currency" items={currencyItems} value={currency} onEnter={next}
                          onChange={(c) => { touched.current.currency = true; setCurrency(c) }}
                          placeholder={t('setup.currencySearch')} empty={t('setup.noMatch')}
                        />
                        <FieldDescription>{t('setup.baseCurrencyHint')}</FieldDescription>
                      </Field>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <div className="flex items-center gap-3">
                        <MemberAvatar name={name} color={color} size="lg" />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium">{name.trim() || t('setup.name')}</span>
                          <Badge variant="primary-light" className="w-fit">{t('role.admin')}</Badge>
                        </div>
                      </div>
                      <Field data-invalid={tried && !name.trim()}>
                        <FieldLabel htmlFor="name">{t('setup.name')}</FieldLabel>
                        <Input id="name" data-first value={name} maxLength={200} aria-invalid={tried && !name.trim()} onChange={(e) => setName(e.target.value)} />
                        {tried && !name.trim() && <FieldError>{t('setup.required')}</FieldError>}
                      </Field>
                      <Field>
                        <FieldLabel id="color-label">{t('setup.color')}</FieldLabel>
                        <RadioGroup aria-labelledby="color-label" value={color} onValueChange={(v) => setColor(v as string)} className="flex flex-wrap gap-4">
                          {MEMBER_COLORS.map((c) => (
                            <Label key={c} className="gap-1.5 font-normal">
                              <RadioGroupItem value={c} aria-label={c} />
                              <span aria-hidden className={cn('size-4 rounded-full', colorClass(c))} />
                            </Label>
                          ))}
                        </RadioGroup>
                      </Field>
                    </>
                  )}

                  {step === 4 && (
                    <>
                      <Field data-invalid={tried && !group.trim()}>
                        <FieldLabel htmlFor="group">{t('setup.groupName')}</FieldLabel>
                        <Input id="group" data-first value={group} maxLength={200} aria-invalid={tried && !group.trim()} onChange={(e) => setGroupName(e.target.value)} />
                        {tried && !group.trim() && <FieldError>{t('setup.required')}</FieldError>}
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="member-0">{t('setup.members')}</FieldLabel>
                        <FieldDescription>{t('setup.membersHint')}</FieldDescription>
                        <div className="flex flex-col gap-2">
                          {members.map((m, i) => (
                            <div key={i} className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span aria-hidden className={cn('size-4 shrink-0 rounded-full', m.trim() ? colorClass(MEMBER_COLORS[(i + 1) % MEMBER_COLORS.length]) : 'bg-border')} />
                                <Input
                                  id={`member-${i}`} ref={(el) => { memberInputs.current[i] = el }} value={m} maxLength={200}
                                  placeholder={t('setup.memberPlaceholder')} aria-invalid={!!memberErrors[i]}
                                  onChange={(e) => setMembers(members.map((o, j) => (j === i ? e.target.value : o)))}
                                  onKeyDown={(e) => onMemberKey(e, i)}
                                />
                                {members.length > 1 && (
                                  <Button variant="ghost" size="icon-sm" aria-label={t('setup.removeMember')} onClick={() => setMembers(members.filter((_, j) => j !== i))}>
                                    <XIcon />
                                  </Button>
                                )}
                              </div>
                              {memberErrors[i] && <FieldError className="pl-6">{memberErrors[i]}</FieldError>}
                            </div>
                          ))}
                        </div>
                      </Field>
                    </>
                  )}

                  {step === 5 && (
                    <RadioGroup aria-label={t('setup.chartTitle')} value={recommended ? 'recommended' : 'core'} onValueChange={(v) => setRecommended(v === 'recommended')}>
                      {([['core', t('setup.chartCoreDesc'), t('setup.chartCoreSample')], ['recommended', t('setup.chartRecommendedDesc'), `${sample}…`]] as const).map(([k, desc, list], i) => (
                        <FieldLabel key={k}>
                          <Field orientation="horizontal">
                            <FieldContent>
                              <FieldTitle>
                                <kbd className="text-xs text-muted-foreground tabular-nums">{i + 1}</kbd>
                                {t(k === 'core' ? 'setup.chartCore' : 'setup.chartRecommended')}
                              </FieldTitle>
                              <FieldDescription>{desc}</FieldDescription>
                              <FieldDescription className="text-xs">{list}</FieldDescription>
                            </FieldContent>
                            <RadioGroupItem value={k} data-first={(k === 'recommended') === recommended || undefined} />
                          </Field>
                        </FieldLabel>
                      ))}
                    </RadioGroup>
                  )}

                  {step === 6 && (
                    <>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                        <Row label={t('setup.country')}>{countries.find((c) => c.value === country)?.label}</Row>
                        <Row label={t('setup.language')}>{t(`language.${language}`)}</Row>
                        <Row label={t('setup.baseCurrency')}>{currency}</Row>
                        <Row label={t('setup.you')}>{name.trim()} · {t('role.admin')}</Row>
                        <Row label={t('setup.groupName')}>{group.trim()}</Row>
                        <Row label={t('setup.memberList')}>{memberNames.join(', ') || t('setup.noMembers')}</Row>
                        <Row label={t('setup.chartTitle')}>{t(recommended ? 'setup.chartRecommended' : 'setup.chartCore')}</Row>
                      </dl>
                      {failed !== null && (
                        <Alert variant="destructive" role="alert" className="animate-in fade-in-0 duration-200">
                          <AlertDescription>{t('setup.failed')} {errorText(failed)}</AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {step > 1 && <Button variant="outline" onClick={() => go(step - 1)}>{t('setup.back')}</Button>}
                    <span className="text-xs text-muted-foreground">{t('setup.keys')}</span>
                  </div>
                  <Button onClick={next} disabled={saving} data-first={step === 6 || undefined}>
                    {saving && <Spinner />}
                    {step < STEPS.length ? t('setup.next') : t(failed !== null ? 'setup.retry' : 'setup.submit')}
                  </Button>
                </CardFooter>
              </div>
            </Card>
          </StepperContent>
        </StepperPanel>
      </Stepper>
    </main>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate font-medium">{children}</dd>
    </>
  )
}
