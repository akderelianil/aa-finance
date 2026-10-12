import { useQueryClient } from '@tanstack/react-query'
import { ChevronRightIcon, UserPlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DataState } from '@/components/DataState'
import { MemberAvatar } from '@/components/members/MemberAvatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { lastMember, setMember, useOp } from '@/lib/api'

// First screen of a session: pick who you are (no PIN), or register when the book has no one yet.
export default function Welcome({ registered, onPick, onRegister }: { registered: boolean; onPick: () => void; onRegister: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const members = useOp('members.list', {}, { enabled: registered })
  const settings = useOp('settings.get', {}, { enabled: registered })
  const last = lastMember()

  function pick(id: number) {
    setMember(id)
    void qc.invalidateQueries()
    onPick()
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pt-[12vh] pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="tracking-tight">{t('welcome.title')}</CardTitle>
          <CardDescription>{registered ? (settings.data?.groupName ?? t('welcome.subtitle')) : t('welcome.empty')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!registered ? (
            <Button autoFocus onClick={onRegister}>
              <UserPlusIcon data-icon="inline-start" />
              {t('welcome.register')}
            </Button>
          ) : members.data ? (
            members.data.map((m, i) => (
              <Button
                key={m.id} variant="outline" size="lg" autoFocus={m.id === last || (i === 0 && !members.data.some((x) => x.id === last))}
                className="justify-start" onClick={() => pick(m.id)}
              >
                <MemberAvatar name={m.name} color={m.color} size="md" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-start leading-tight">
                  <span className="truncate text-sm font-medium">{m.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t(`role.${m.role}`)}{m.id === last && ` · ${t('welcome.last')}`}
                  </span>
                </span>
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            ))
          ) : (
            <DataState loading={members.isPending} error={members.isError} onRetry={() => void members.refetch()} />
          )}
        </CardContent>
      </Card>
    </main>
  )
}
