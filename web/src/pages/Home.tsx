import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { PageShell, FormError } from '@/components/PageShell'
import { QuickEntry } from '@/components/QuickEntry'
import { RecentEntries, type EntryRow } from '@/components/RecentEntries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export default function Home({ membership }: { membership: Membership }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()
  const [lockDate, setLockDate] = useState(membership.group.lock_date ?? '')
  const lock = useMutation({
    mutationFn: () => callFunction('group-update', { lock_date: lockDate || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['membership'] }),
  })
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
            <div className="flex flex-col gap-2 border-t pt-3">
              <Label htmlFor="lock-date">{t('home.lockDate')}</Label>
              <div className="flex gap-2">
                <Input id="lock-date" type="date" value={lockDate} onChange={(e) => setLockDate(e.target.value)} />
                <Button variant="outline" disabled={lock.isPending} onClick={() => lock.mutate()}>{t('entry.save')}</Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('home.lockHint')}</p>
              <FormError message={lock.error ? errorMessage(t, lock.error) : null} />
            </div>
          </CardContent>
        )}
      </Card>
      <QuickEntry
        key={editing?.id ?? 'new'} membership={membership} editing={editing} onDone={() => setEditing(null)}
      />
      <RecentEntries membership={membership} exponent={exponent} onEdit={setEditing} />
      <Button variant="outline" nativeButton={false} render={<Link to="/accounts" />}>{t('accounts.title')}</Button>
      <Button variant="outline" nativeButton={false} render={<Link to="/people" />}>{t('people.title')}</Button>
      <Button variant="outline" nativeButton={false} render={<Link to="/installments" />}>{t('installments.title')}</Button>
      <Button variant="outline" nativeButton={false} render={<Link to="/investments" />}>{t('investments.title')}</Button>
      <Button variant="outline" nativeButton={false} render={<Link to="/reports" />}>{t('reports.title')}</Button>
      <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>{t('common.logout')}</Button>
    </PageShell>
  )
}
