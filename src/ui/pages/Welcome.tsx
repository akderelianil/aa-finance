import { useQueryClient } from '@tanstack/react-query'
import { ChevronRightIcon, UserPlusIcon } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { DataState } from '@/components/DataState'
import { MemberAvatar } from '@/components/members/MemberAvatar'
import { PinCard } from '@/components/members/PinCard'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useOp } from '@/lib/api'
import { dropLock, lastMember, signedIn, useNowSeconds, useSession } from '@/lib/session'

// Gate: pick who you are, then the PIN screen (or "PIN belirle" for a member without one). Also the idle lock screen
// (`lockedFor` starts on that member's PIN). With no one registered yet, Register leads to Setup. Flow: docs/product-designer/ux/pin.md.
export default function Welcome({ registered, onRegister }: { registered: boolean; onRegister: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { lockedFor, waits } = useSession()
  const now = useNowSeconds()
  const members = useOp('members.list', {}, { enabled: registered })
  const group = useOp('settings.groupName', {}, { enabled: registered })
  const [chosen, setChosen] = useState<number | null>(lockedFor)
  const last = useRef(lastMember()).current
  const list = useRef<HTMLDivElement>(null)
  const chosenMember = members.data?.find((m) => m.id === chosen)

  async function enter(id: number) {
    // The same member after an idle lock keeps the screen (refetch only); anyone else starts on fresh data.
    if (id === lockedFor) await qc.invalidateQueries()
    else await qc.resetQueries()
    signedIn(id)
  }

  function back() {
    dropLock()
    setChosen(null)
  }

  // ↑↓ move between members.
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const rows = [...(list.current?.querySelectorAll<HTMLElement>('button') ?? [])]
    const i = rows.indexOf(document.activeElement as HTMLElement)
    rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus()
  }

  const preselect = members.data?.some((x) => x.id === last) ? last : members.data?.[0]?.id

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pt-[12vh] pb-8">
      {chosenMember ? (
        <PinCard member={chosenMember} idle={chosenMember.id === lockedFor} onBack={back} onIn={enter} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="tracking-tight">{t('welcome.title')}</CardTitle>
            <CardDescription>{registered ? (group.data?.groupName ?? t('welcome.subtitle')) : t('welcome.empty')}</CardDescription>
          </CardHeader>
          <CardContent ref={list} onKeyDown={onKeyDown} className="flex flex-col gap-2">
            {!registered ? (
              <Button autoFocus onClick={onRegister}>
                <UserPlusIcon data-icon="inline-start" />
                {t('welcome.register')}
              </Button>
            ) : members.data ? (
              members.data.map((m) => {
                const left = Math.max(0, Math.ceil((waits[m.id] ?? 0) / 1000 - now))
                return (
                  <Button
                    key={m.id} variant="outline" size="lg" autoFocus={m.id === preselect}
                    className="justify-start" onClick={() => setChosen(m.id)}
                  >
                    <MemberAvatar name={m.name} color={m.color} size="md" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-start leading-tight">
                      <span className="truncate text-sm font-medium">{m.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {t(`role.${m.role}`)}{m.id === last && ` · ${t('welcome.last')}`}
                      </span>
                    </span>
                    {left > 0 ? <Badge variant="warning-light">{t('pin.waitRow', { n: left })}</Badge>
                      : !m.hasPin && <Badge variant="secondary">{t('pin.notSet')}</Badge>}
                    <ChevronRightIcon data-icon="inline-end" />
                  </Button>
                )
              })
            ) : (
              <DataState loading={members.isPending} error={members.isError} onRetry={() => void members.refetch()} />
            )}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
