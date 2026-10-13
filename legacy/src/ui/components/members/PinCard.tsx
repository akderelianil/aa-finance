import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Member } from '../../../core/api/members.ts'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, call, useErrorText } from '@/lib/api'
import { clearWait, setWait, useWaitLeft } from '@/lib/session'
import { MemberAvatar } from './MemberAvatar'
import { PinInput } from './PinInput'

// One screen for the open PIN, the idle lock and the first PIN ("PIN belirle"). Flow: docs/product-designer/ux/pin.md.
// The 6th digit submits. Esc goes back to the member list (Üye değiştir).
export function PinCard({ member, idle, onBack, onIn }: { member: Member; idle: boolean; onBack: () => void; onIn: (id: number) => void | Promise<void> }) {
  const { t } = useTranslation()
  const setMode = !member.hasPin
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)
  const second = useRef<HTMLInputElement>(null)
  const first = useRef<HTMLInputElement>(null)
  const errorText = useErrorText()
  const left = useWaitLeft(member.id)
  const waiting = left > 0

  // Wait over: free the input again.
  useEffect(() => { if (!waiting) clearWait(member.id) }, [waiting, member.id])

  const focusFirst = () => setTimeout(() => first.current?.focus())
  const fail = (e: unknown) => {
    setA(''); setB('')
    setShake(true)
    setTimeout(() => setShake(false), 350)
    if (e instanceof ApiError && e.code === 'pin_wrong') {
      setError(t('pin.wrong', { n: (e.details as { triesLeft?: number } | undefined)?.triesLeft ?? 0 }))
    } else if (e instanceof ApiError && e.code === 'pin_wait') {
      setWait(member.id, (e.details as { seconds?: number } | undefined)?.seconds ?? 30)
      setError(null)
    } else setError(errorText(e))
    focusFirst()
  }

  async function enter(pin: string) {
    setBusy(true)
    setError(null)
    try {
      await call('members.signIn', { id: member.id, pin })
      clearWait(member.id)
      await onIn(member.id)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  async function setFirst(repeat: string) {
    if (repeat !== a) {
      setA(''); setB('')
      setShake(true)
      setTimeout(() => setShake(false), 350)
      setError(t('pin.mismatch'))
      focusFirst()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await call('members.setPin', { id: member.id, pin: a })
      await enter(a)
    } catch (e) {
      fail(e)
      setBusy(false)
    }
  }

  // Esc: while setting a PIN and in the repeat field, back to the first field; otherwise to the member list.
  const esc = useRef<(e: KeyboardEvent) => void>(() => {})
  esc.current = (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    if (setMode && document.activeElement === second.current) {
      setB('')
      first.current?.focus()
    } else onBack()
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => esc.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const message = waiting ? t('pin.wait', { n: left }) : error
  const disabled = busy || waiting

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div className="justify-self-center"><MemberAvatar name={member.name} color={member.color} size="lg" /></div>
        <CardTitle className="tracking-tight">{setMode ? t('pin.setTitle') : member.name}</CardTitle>
        <CardDescription>
          {setMode ? t('pin.setHint') : idle ? t('pin.idle') : t('pin.enter')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {setMode && <span className="text-sm font-medium">{member.name}</span>}
        {setMode ? (
          <>
            <PinInput
              label={t('pin.new')} value={a} onChange={setA} disabled={disabled} autoFocus inputRef={first}
              onComplete={() => second.current?.focus()} shake={shake} invalid={!!error}
            />
            <span className="text-xs text-muted-foreground">{t('pin.repeat')}</span>
            <PinInput
              label={t('pin.repeat')} value={b} onChange={setB} disabled={disabled} inputRef={second}
              onComplete={(v) => void setFirst(v)} shake={shake} invalid={!!error}
            />
          </>
        ) : (
          <PinInput
            label={t('pin.label')} value={a} onChange={setA} disabled={disabled} autoFocus inputRef={first}
            onComplete={(v) => void enter(v)} shake={shake} invalid={!!error}
          />
        )}
        <div className="min-h-9 w-full" aria-live="polite">
          {message && (
            <Alert variant={waiting ? 'warning' : 'destructive'} role="alert">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-3">
        <Button variant="link" onClick={onBack}>{t('pin.switch')}</Button>
        <p className="text-center text-xs text-muted-foreground">{setMode ? t('pin.fileNote') : t('pin.forgot')}</p>
      </CardFooter>
    </Card>
  )
}
