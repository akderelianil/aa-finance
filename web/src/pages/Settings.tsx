import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AvatarPicker } from '@/components/AvatarPicker'
import type { Membership } from '@/auth/useMembership'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { initials, uploadAvatar } from '@/lib/avatar'
import { errorMessage } from '@/lib/errors'

export default function Settings({ membership }: { membership: Membership }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [lockDate, setLockDate] = useState(membership.group.lock_date ?? '')
  const lock = useMutation({
    mutationFn: () => callFunction('group-update', { lock_date: lockDate || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['membership'] }),
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['membership'] })
  const [firstName, setFirstName] = useState(membership.firstName ?? '')
  const [lastName, setLastName] = useState(membership.lastName ?? '')
  const profile = useMutation({
    mutationFn: (body: Record<string, unknown>) => callFunction('profile-update', body),
    onSuccess: refresh,
  })
  const [groupName, setGroupName] = useState(membership.group.name)
  const group = useMutation({
    mutationFn: (body: Record<string, unknown>) => callFunction('group-update', body),
    onSuccess: refresh,
  })
  const isAdmin = membership.role === 'admin'
  const invite = useMutation({
    mutationFn: () => callFunction<{ code: string; expires_at: string }>('invite-create'),
  })

  async function copy(code: string) {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">{t('settings.title')}</h1>
      <Card>
        <CardHeader><CardTitle>{t('profile.title')}</CardTitle></CardHeader>
        <CardContent>
          <FieldGroup>
            <AvatarPicker
              path={membership.avatarUrl}
              fallback={initials(membership.displayName)}
              onPick={async (file) => { await profile.mutateAsync({ avatar_path: await uploadAvatar('user', file) }) }}
              onRemove={async () => { await profile.mutateAsync({ avatar_path: null }) }}
            />
            <Field>
              <FieldLabel htmlFor="first-name">{t('profile.firstName')}</FieldLabel>
              <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="last-name">{t('profile.lastName')}</FieldLabel>
              <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
            <Button
              variant="outline" disabled={profile.isPending || !firstName.trim() || !lastName.trim()}
              onClick={() => profile.mutate({ first_name: firstName.trim(), last_name: lastName.trim() })}
            >
              {t('entry.save')}
            </Button>
            <FormError message={profile.error ? errorMessage(t, profile.error) : null} />
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.groupSection')}</CardTitle>
          <CardDescription>
            {t('home.baseCurrency')}: {membership.group.base_currency} · {t(`home.role.${membership.role}`)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {isAdmin && (
              <>
                <AvatarPicker
                  path={membership.group.avatar_url}
                  fallback={initials(membership.group.name)}
                  onPick={async (file) => { await group.mutateAsync({ avatar_path: await uploadAvatar('group', file) }) }}
                  onRemove={async () => { await group.mutateAsync({ avatar_path: null }) }}
                />
                <Field>
                  <FieldLabel htmlFor="group-name">{t('profile.groupName')}</FieldLabel>
                  <div className="flex gap-2">
                    <Input id="group-name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                    <Button variant="outline" disabled={group.isPending || !groupName.trim()} onClick={() => group.mutate({ name: groupName.trim() })}>
                      {t('entry.save')}
                    </Button>
                  </div>
                </Field>
                <Field>
                  <FieldLabel>{t('profile.kind')}</FieldLabel>
                  <ToggleGroup
                    variant="outline" value={[membership.group.kind]}
                    onValueChange={(v) => { const k = v[0]; if (k) group.mutate({ kind: k }) }}
                  >
                    <ToggleGroupItem value="family">{t('profile.family')}</ToggleGroupItem>
                    <ToggleGroupItem value="group">{t('profile.group')}</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <FormError message={group.error ? errorMessage(t, group.error) : null} />
              </>
            )}
            {isAdmin && (
              <>
              <Field>
                {invite.data ? (
                  <div className="flex flex-col items-center gap-2">
                    <FieldLabel>{t('home.inviteCode')}</FieldLabel>
                    <p className="font-mono text-3xl tracking-[0.3em]">{invite.data.code}</p>
                    <Button variant="outline" size="sm" onClick={() => void copy(invite.data.code)}>
                      {copied ? t('home.copied') : t('home.copy')}
                    </Button>
                    <FieldDescription>{t('home.inviteHint')}</FieldDescription>
                  </div>
                ) : (
                  <Button variant="outline" disabled={invite.isPending} onClick={() => invite.mutate()}>
                    {t('home.invite')}
                  </Button>
                )}
                <FormError message={invite.error ? errorMessage(t, invite.error) : null} />
              </Field>
              <Field>
                <FieldLabel htmlFor="lock-date">{t('home.lockDate')}</FieldLabel>
                <div className="flex gap-2">
                  <Input id="lock-date" type="date" value={lockDate} onChange={(e) => setLockDate(e.target.value)} />
                  <Button variant="outline" disabled={lock.isPending} onClick={() => lock.mutate()}>{t('entry.save')}</Button>
                </div>
                <FieldDescription>{t('home.lockHint')}</FieldDescription>
                <FormError message={lock.error ? errorMessage(t, lock.error) : null} />
              </Field>
              </>
            )}
          </FieldGroup>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t('settings.more')}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button variant="outline" nativeButton={false} render={<Link to="/ayarlar/kisiler" />}>{t('people.title')}</Button>
          <Button variant="outline" nativeButton={false} render={<Link to="/ayarlar/taksitler" />}>{t('installments.title')}</Button>
          <Button variant="outline" nativeButton={false} render={<Link to="/ayarlar/yatirimlar" />}>{t('investments.title')}</Button>
        </CardContent>
      </Card>
    </>
  )
}
