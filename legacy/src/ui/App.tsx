import { lazy, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { DataState } from '@/components/DataState'
import { ApiError, useOp } from '@/lib/api'
import { autoBackup } from '@/lib/files'
import { MemberContext } from '@/lib/kept'
import { IDLE_MS, lock, savedPath, savePath, signedIn as signIn, useSession } from '@/lib/session'
import Setup from '@/pages/Setup'
import Welcome from '@/pages/Welcome'

// Pages load on first visit: a smaller first bundle.
const Accounts = lazy(() => import('@/pages/Accounts'))
const AccountRegister = lazy(() => import('@/pages/AccountRegister'))
const Journal = lazy(() => import('@/pages/Journal'))
const Reports = lazy(() => import('@/pages/Reports'))
const Directory = lazy(() => import('@/pages/Directory'))
const Rates = lazy(() => import('@/pages/Rates'))
const Settings = lazy(() => import('@/pages/Settings'))
const Activity = lazy(() => import('@/pages/Activity'))

// The gate comes first: pick a member, then the PIN (pin.md). Not set up → Register leads to Setup.
// Signed in → that member's screen. An idle lock keeps the screen mounted (hidden) for the same member's PIN.

/** Idle lock: no input for IDLE_MS. */
function useIdleLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    let last = Date.now()
    const touch = () => { last = Date.now() }
    const events = ['keydown', 'pointerdown', 'pointermove', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }))
    const timer = setInterval(() => { if (Date.now() - last >= IDLE_MS) lock(true) }, 5000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch, { capture: true }))
      clearInterval(timer)
    }
  }, [active])
}

/** While locked, dialogs and menus of the hidden screen (portaled to <body>) are made inert and invisible. */
function useHidePortals(locked: boolean, gate: HTMLElement) {
  useEffect(() => {
    if (!locked) return
    const hidden = [...document.body.children].filter((el): el is HTMLElement =>
      el instanceof HTMLElement && el !== gate && el.id !== 'root' && !el.hasAttribute('inert'))
    hidden.forEach((el) => { el.setAttribute('inert', ''); el.style.visibility = 'hidden' })
    return () => hidden.forEach((el) => { el.removeAttribute('inert'); el.style.visibility = '' })
  }, [locked, gate])
}

const gateHost = document.createElement('div')
document.body.append(gateHost)

function PathTracker({ id }: { id: number }) {
  const { pathname } = useLocation()
  useEffect(() => savePath(id, pathname), [id, pathname])
  return null
}

// One member's screen: own router (the open page is saved per member), so a member starts clean and an idle lock keeps everything.
function MemberSpace({ id }: { id: number }) {
  const settings = useOp('settings.get', {})
  const [start] = useState(() => savedPath(id) ?? '/hesaplar')
  if (!settings.data) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <DataState loading={settings.isPending} error={settings.isError} onRetry={() => void settings.refetch()} />
      </main>
    )
  }
  return (
    <MemberContext.Provider value={id}>
    <MemoryRouter initialEntries={[start]}>
      <PathTracker id={id} />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/hesaplar" element={<Accounts />} />
          <Route path="/hesaplar/:id" element={<AccountRegister />} />
          <Route path="/yevmiye" element={<Journal />} />
          <Route path="/raporlar" element={<Reports />} />
          <Route path="/rehber" element={<Directory />} />
          <Route path="/kurlar" element={<Rates />} />
          <Route path="/ayarlar" element={<Settings />} />
          <Route path="/etkinlik" element={<Activity />} />
        </Route>
        <Route path="*" element={<Navigate to="/hesaplar" replace />} />
      </Routes>
    </MemoryRouter>
    </MemberContext.Provider>
  )
}

export default function App() {
  const { i18n } = useTranslation()
  const { signedIn, lockedFor } = useSession()
  // Open while locked: tells "not set up" apart from "set up, locked". Everything else needs a signed-in member.
  const group = useOp('settings.groupName', {})
  const settings = useOp('settings.get', {}, { enabled: signedIn !== null })
  const language = settings.data?.language

  useEffect(() => {
    if (language && i18n.language !== language) void i18n.changeLanguage(language)
  }, [language, i18n])

  // Once signed in: today's automatic backup (a failure must not stop the app).
  const ready = !!settings.data
  useEffect(() => {
    if (ready) autoBackup().catch((e) => console.error('auto backup', e))
  }, [ready])

  useIdleLock(signedIn !== null)
  useHidePortals(lockedFor !== null && signedIn === null, gateHost)

  // Setup stays on screen until its done moment ends.
  const [inSetup, setInSetup] = useState(false)
  if (inSetup) return <Setup onBack={() => setInSetup(false)} onFinish={(id) => { signIn(id); setInSetup(false) }} />

  const notSetup = group.error instanceof ApiError && group.error.code === 'not_setup'
  const shown = signedIn ?? lockedFor
  if (shown === null && !notSetup && !group.data) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <DataState loading={group.isPending} error={group.isError} onRetry={() => void group.refetch()} />
      </main>
    )
  }

  return (
    <>
      {shown !== null && (
        <div className={signedIn === null ? 'hidden' : 'contents'}>
          <MemberSpace key={shown} id={shown} />
        </div>
      )}
      {signedIn === null && createPortal(
        <div className="fixed inset-0 z-[2000] overflow-auto bg-background">
          <Welcome registered={!notSetup} onRegister={() => setInSetup(true)} />
        </div>,
        gateHost,
      )}
    </>
  )
}
