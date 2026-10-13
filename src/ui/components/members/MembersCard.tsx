import { KeyRoundIcon, PencilIcon, PlusIcon, RotateCcwKeyIcon, UserMinusIcon } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MEMBER_COLORS } from '../../../core/setup.ts'
import type { Grants, Member } from '../../../core/api/members.ts'
import { DataState } from '@/components/DataState'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'
import { ApiError, useErrorText, useOp, useWrite } from '@/lib/api'
import { forgetState } from '@/lib/session'
import { colorClass } from '@/lib/members'
import { cn } from '@/lib/utils'
import { MemberAvatar } from './MemberAvatar'
import { PinInput } from './PinInput'

type Target = { mode: 'add' } | { mode: 'edit'; member: Member }

const GRANT_KEYS = ['accounts', 'rates', 'contacts'] as const
const GRANT_LABEL = { accounts: 'members.grantAccounts', rates: 'members.grantRates', contacts: 'members.grantContacts' } as const
const NO_GRANTS: Grants = { accounts: false, rates: false, contacts: false }

// Settings: the members. Everyone edits own name and color; an admin adds members and changes others and roles.
export function MembersCard({ admin }: { admin: boolean }) {
  const { t } = useTranslation()
  const members = useOp('members.list', {})
  const [target, setTarget] = useState<Target | null>(null)
  const [changing, setChanging] = useState<Member | null>(null)
  const [resetting, setResetting] = useState<Member | null>(null)
  const [removing, setRemoving] = useState<Member | null>(null)

  return (
    <Frame>
      <FramePanel className="p-0">
      <FrameHeader className="flex-row items-start justify-between gap-4 border-b">
        <div className="flex flex-col gap-0.5">
          <FrameTitle>{t('members.title')}</FrameTitle>
          <FrameDescription>{t('members.subtitle')}</FrameDescription>
        </div>
        {admin && (
          <Button variant="outline" size="sm" onClick={() => setTarget({ mode: 'add' })}>
            <PlusIcon data-icon="inline-start" />
            {t('members.add')}
          </Button>
        )}
      </FrameHeader>
      <div>
        {members.data ? (
          <ul className="flex flex-col divide-y">
            {members.data.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2">
                <MemberAvatar name={m.name} color={m.color} size="md" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}</span>
                {m.me && <Badge variant="info-light">{t('members.you')}</Badge>}
                {!m.hasPin && <Badge variant="warning-light">{t('pin.notSet')}</Badge>}
                <Badge variant={m.role === 'admin' ? 'primary-light' : 'secondary'}>{t(`role.${m.role}`)}</Badge>
                {m.me && (
                  <Button variant="ghost" size="icon-sm" aria-label={t('pin.change')} onClick={() => setChanging(m)}>
                    <KeyRoundIcon />
                  </Button>
                )}
                {admin && !m.me && m.hasPin && (
                  <Button variant="ghost" size="icon-sm" aria-label={`${t('pin.reset')}: ${m.name}`} onClick={() => setResetting(m)}>
                    <RotateCcwKeyIcon />
                  </Button>
                )}
                {admin && !m.me && (
                  <Button variant="ghost" size="icon-sm" aria-label={`${t('members.remove')}: ${m.name}`} onClick={() => setRemoving(m)}>
                    <UserMinusIcon />
                  </Button>
                )}
                <Button
                  variant="ghost" size="icon-sm" aria-label={`${t('members.edit')}: ${m.name}`}
                  disabled={!admin && !m.me} onClick={() => setTarget({ mode: 'edit', member: m })}
                >
                  <PencilIcon />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <DataState loading={members.isPending} error={members.isError} onRetry={() => void members.refetch()} />
        )}
      </div>
      <Dialog open={!!target} onOpenChange={(o) => { if (!o) setTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{target?.mode === 'edit' ? t('members.edit') : t('members.add')}</DialogTitle>
            <DialogDescription>{t('members.roleHint')}</DialogDescription>
          </DialogHeader>
          {target && (
            <MemberForm
              key={target.mode === 'edit' ? target.member.id : 'new'}
              target={target} admin={admin} count={members.data?.length ?? 0} onClose={() => setTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!changing} onOpenChange={(o) => { if (!o) setChanging(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pin.change')}</DialogTitle>
            <DialogDescription>{t('pin.changeHint')}</DialogDescription>
          </DialogHeader>
          {changing && <ChangePinForm member={changing} onClose={() => setChanging(null)} />}
        </DialogContent>
      </Dialog>
      <ResetPinDialog member={resetting} onClose={() => setResetting(null)} />
      <RemoveMemberDialog member={removing} onClose={() => setRemoving(null)} />
      </FramePanel>
    </Frame>
  )
}

function MemberForm({ target, admin, count, onClose }: { target: Target; admin: boolean; count: number; onClose: () => void }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const old = target.mode === 'edit' ? target.member : null
  const [name, setName] = useState(old?.name ?? '')
  const [color, setColor] = useState<string>(old?.color ?? MEMBER_COLORS[count % MEMBER_COLORS.length])
  const [role, setRole] = useState<Member['role']>(old?.role ?? 'member')
  const [grants, setGrants] = useState<Grants>(old?.grants ?? NO_GRANTS)
  const [tried, setTried] = useState(false)
  const add = useWrite('members.add', { inline: true })
  const edit = useWrite('members.update', { inline: true })
  const save = old ? edit : add
  const nameMissing = !name.trim()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (nameMissing) return
    const done = { onSuccess: () => { onClose() } }
    const grantsChanged = old ? GRANT_KEYS.some((k) => grants[k] !== old.grants[k]) : GRANT_KEYS.some((k) => grants[k])
    const grantsInput = admin && role === 'member' && grantsChanged ? { grants } : {}
    if (!old) add.mutate({ name: name.trim(), color, role, ...grantsInput }, done)
    else edit.mutate({
      id: old.id,
      ...(name.trim() !== old.name && { name: name.trim() }),
      ...(color !== old.color && { color }),
      ...(role !== old.role && { role }),
      ...grantsInput,
    }, done)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FieldGroup>
        <div className="flex items-center gap-3">
          <MemberAvatar name={name} color={color} size="lg" />
          <span className="truncate text-sm font-medium">{name.trim() || t('members.name')}</span>
        </div>
        <Field data-invalid={tried && nameMissing}>
          <FieldLabel htmlFor="member-name">{t('members.name')}</FieldLabel>
          <Input id="member-name" autoFocus value={name} maxLength={200} aria-invalid={tried && nameMissing} onChange={(e) => setName(e.target.value)} />
          {tried && nameMissing && <FieldError>{t('setup.required')}</FieldError>}
        </Field>
        <Field>
          <FieldLabel id="member-color">{t('members.color')}</FieldLabel>
          <RadioGroup aria-labelledby="member-color" value={color} onValueChange={(v) => setColor(v as string)} className="flex flex-wrap gap-4">
            {MEMBER_COLORS.map((c) => (
              <Label key={c} className="gap-1.5 font-normal">
                <RadioGroupItem value={c} aria-label={c} />
                <span aria-hidden className={cn('size-4 rounded-full', colorClass(c))} />
              </Label>
            ))}
          </RadioGroup>
        </Field>
        <Field>
          <FieldLabel id="member-role">{t('members.role')}</FieldLabel>
          <RadioGroup aria-labelledby="member-role" value={role} onValueChange={(v) => setRole(v as Member['role'])} disabled={!admin} className="flex gap-6">
            {(['member', 'admin'] as const).map((r) => (
              <Label key={r} className="gap-2 font-normal">
                <RadioGroupItem value={r} />
                {t(`role.${r}`)}
              </Label>
            ))}
          </RadioGroup>
          {!admin && <FieldDescription>{t('members.adminOnly')}</FieldDescription>}
        </Field>
        {role === 'member' && (
          <Field>
            <FieldLabel id="member-grants">{t('members.grants')}</FieldLabel>
            <div role="group" aria-labelledby="member-grants" className="flex flex-wrap gap-x-6 gap-y-2">
              {GRANT_KEYS.map((k) => (
                <Label key={k} className="gap-2 font-normal">
                  <Checkbox checked={grants[k]} disabled={!admin} onCheckedChange={(v) => setGrants((g) => ({ ...g, [k]: v === true }))} />
                  {t(GRANT_LABEL[k])}
                </Label>
              ))}
            </div>
            <FieldDescription>{admin ? t('members.grantsHint') : t('members.adminOnly')}</FieldDescription>
          </Field>
        )}
        {save.error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(save.error)}</AlertDescription></Alert>}
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner data-icon="inline-start" />}
          {t('common.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** A PIN error as one line: tries left, the wait, or the generic message. */
function usePinError() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  return (e: unknown) => {
    const d = e instanceof ApiError ? (e.details as { triesLeft?: number; seconds?: number } | undefined) : undefined
    if (e instanceof ApiError && e.code === 'pin_wrong') return t('pin.wrong', { n: d?.triesLeft ?? 0 })
    if (e instanceof ApiError && e.code === 'pin_wait') return t('pin.wait', { n: d?.seconds ?? 0 })
    return errorText(e)
  }
}

// Own PIN: current, new, repeat. The repeat's 6th digit saves. A wrong current PIN counts toward the wait.
function ChangePinForm({ member, onClose }: { member: Member; onClose: () => void }) {
  const { t } = useTranslation()
  const pinError = usePinError()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const save = useWrite('members.setPin', { inline: true })
  const fields = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  function submit(again: string) {
    if (again !== next) {
      setRepeat('')
      setError(t('pin.mismatch'))
      return
    }
    setError(null)
    save.mutate({ id: member.id, pin: next, current }, {
      onSuccess: onClose,
      onError: (e) => {
        setError(pinError(e))
        setCurrent(''); setRepeat('')
        fields[0].current?.focus()
      },
    })
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {([
        [t('pin.current'), current, setCurrent, 0],
        [t('pin.new'), next, setNext, 1],
        [t('pin.repeat'), repeat, setRepeat, 2],
      ] as const).map(([label, value, set, i]) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <PinInput
            label={label} value={value} onChange={set} inputRef={fields[i]} autoFocus={i === 0}
            disabled={save.isPending} invalid={!!error && i === 2}
            onComplete={(v) => (i < 2 ? fields[i + 1].current?.focus() : submit(v))}
          />
        </div>
      ))}
      <div className="min-h-9 w-full" aria-live="polite">
        {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      </div>
      <DialogFooter className="w-full">
        <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
      </DialogFooter>
    </div>
  )
}

// Admin: clear another member's PIN. They set a new one at their next sign-in; their saved screen state is dropped.
function ResetPinDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const reset = useWrite('members.resetPin', { inline: true })
  return (
    <AlertDialog open={!!member} onOpenChange={(o) => { if (!o) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('pin.resetTitle', { name: member?.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('pin.resetBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        {reset.error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(reset.error)}</AlertDescription></Alert>}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive" disabled={reset.isPending}
            onClick={(ev) => {
              ev.preventDefault()
              if (member) reset.mutate({ id: member.id }, { onSuccess: () => { forgetState(member.id); onClose() } })
            }}
          >
            {t('pin.resetAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Admin: take a member out of the book. They cannot sign in again; their entries stay and keep their name.
function RemoveMemberDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const remove = useWrite('members.remove', { inline: true })
  return (
    <AlertDialog open={!!member} onOpenChange={(o) => { if (!o) { remove.reset(); onClose() } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('members.removeTitle', { name: member?.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('members.removeBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        {remove.error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(remove.error)}</AlertDescription></Alert>}
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive" disabled={remove.isPending}
            onClick={(ev) => {
              ev.preventDefault()
              if (member) remove.mutate({ id: member.id }, { onSuccess: () => { forgetState(member.id); onClose() } })
            }}
          >
            {t('members.removeAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
