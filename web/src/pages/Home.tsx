import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { PageShell, FormError } from '@/components/PageShell'
import { QuickEntry } from '@/components/QuickEntry'
import { RecentEntries, type EntryRow } from '@/components/RecentEntries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export default function Home({ membership }: { membership: Membership }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState<EntryRow | null>(null)
  const exponent = new Intl.NumberFormat('en', { style: 'currency', currency: membership.group.base_currency })
    .resolvedOptions().maximumFractionDigits ?? 2

  const invite = useMutation({
    mutationFn: () => callFunction<{ code: string; expires_at: string }>('invite-create'),
  })

  async function copy(code: string) {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <PageShell>
      <h1 className="text-2xl font-semibold">{t('home.greeting', { name: membership.displayName ?? '' })}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{membership.group.name}</CardTitle>
          <CardDescription>
            {t('home.baseCurrency')}: {membership.group.base_currency} · {t(`home.role.${membership.role}`)}
          </CardDescription>
        </CardHeader>
        {membership.role === 'admin' && (
          <CardContent className="flex flex-col gap-3">
            {invite.data ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">{t('home.inviteCode')}</p>
                <p className="font-mono text-3xl tracking-[0.3em]">{invite.data.code}</p>
                <Button variant="outline" size="sm" onClick={() => void copy(invite.data.code)}>
                  {copied ? t('home.copied') : t('home.copy')}
                </Button>
                <p className="text-xs text-muted-foreground">{t('home.inviteHint')}</p>
              </div>
            ) : (
              <Button variant="outline" disabled={invite.isPending} onClick={() => invite.mutate()}>
                {t('home.invite')}
              </Button>
            )}
            <FormError message={invite.error ? errorMessage(t, invite.error) : null} />
          </CardContent>
        )}
      </Card>
      <QuickEntry
        key={editing?.id ?? 'new'} membership={membership} editing={editing} onDone={() => setEditing(null)}
      />
      <RecentEntries membership={membership} exponent={exponent} onEdit={setEditing} />
      <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>{t('common.logout')}</Button>
    </PageShell>
  )
}
