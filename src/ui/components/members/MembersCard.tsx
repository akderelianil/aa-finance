import { PencilIcon, PlusIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MEMBER_COLORS } from '../../../core/setup.ts'
import type { Member } from '../../../core/api/members.ts'
import { DataState } from '@/components/DataState'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { useErrorText, useOp, useWrite } from '@/lib/api'
import { colorClass } from '@/lib/members'
import { cn } from '@/lib/utils'
import { MemberAvatar } from './MemberAvatar'

type Target = { mode: 'add' } | { mode: 'edit'; member: Member }

// Settings: the members. Everyone edits own name and color; an admin adds members and changes others and roles.
export function MembersCard({ admin }: { admin: boolean }) {
  const { t } = useTranslation()
  const members = useOp('members.list', {})
  const [target, setTarget] = useState<Target | null>(null)

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
                <Badge variant={m.role === 'admin' ? 'primary-light' : 'secondary'}>{t(`role.${m.role}`)}</Badge>
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
  const [tried, setTried] = useState(false)
  const add = useWrite('members.add')
  const edit = useWrite('members.update')
  const save = old ? edit : add
  const nameMissing = !name.trim()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setTried(true)
    if (nameMissing) return
    const done = { onSuccess: () => { toast.add({ title: t('members.saved'), timeout: 2500 }); onClose() } }
    if (!old) add.mutate({ name: name.trim(), color, role }, done)
    else edit.mutate({
      id: old.id,
      ...(name.trim() !== old.name && { name: name.trim() }),
      ...(color !== old.color && { color }),
      ...(role !== old.role && { role }),
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
