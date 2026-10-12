import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { OptionSelect } from '@/components/OptionSelect'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import {
  Cascader, CascaderContent, CascaderEmpty, CascaderList, CascaderPanel, CascaderStatus, CascaderTrigger,
} from '@/components/reui/cascader/cascader'
import { CascaderItems } from '@/components/reui/cascader/cascader-item'
import { CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue } from '@/components/reui/cascader/cascader-nav'
import type { CascaderNode } from '@/components/reui/cascader/cascader-types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useErrorText, useOp, useWrite } from '@/lib/api'
import { flattenTree, type AccountNode } from '@/lib/ledger'
import { cn } from '@/lib/utils'

export type AccountTarget = { mode: 'create'; parent: AccountNode | null } | { mode: 'edit'; node: AccountNode }

type Props = {
  target: AccountTarget | null
  roots: AccountNode[]
  currencies: string[]
  onClose: () => void
}

/** Accounts that take children: groups and the two person accounts. */
export const takesChildren = (n: AccountNode) => n.placeholder || n.systemKey === 'receivables' || n.systemKey === 'payables' || !n.locked

// New / edit account. The user picks the group; the account takes its type. Codes are hidden.
export function AccountDialog({ target, ...rest }: Props) {
  const { t } = useTranslation()
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) rest.onClose() }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{target?.mode === 'edit' ? t('coa.editTitle') : t('coa.newTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('nav.accounts')}</DialogDescription>
        </DialogHeader>
        {target && <Form key={target.mode === 'edit' ? target.node.id : (target.parent?.id ?? 'root')} target={target} {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

function Form({ target, roots, currencies, onClose }: Props & { target: AccountTarget }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const edit = target.mode === 'edit' ? target.node : null
  const initialParent = edit ? edit.parent : target.mode === 'create' ? (target.parent?.id ?? null) : null
  const byId = new Map(flattenTree(roots).map((n) => [n.id, n]))

  const [name, setName] = useState(edit?.name ?? '')
  const [parentId, setParentId] = useState(initialParent ?? 0)
  const parent = parentId ? byId.get(parentId) : undefined
  const [currency, setCurrency] = useState(edit?.currency ?? parent?.currency ?? currencies[0] ?? '')
  const [placeholder, setPlaceholder] = useState(edit?.placeholder ?? false)
  // '' = Ortak (no owner). A new account starts with its parent's owner.
  const members = useOp('members.list', {}).data ?? []
  const [ownerId, setOwnerId] = useState(String((edit ? edit.owner : parent?.owner) ?? ''))
  // An account with lines keeps its currency and cannot become a group; the database checks too.
  const used = !!edit && edit.balance !== 0

  // Parents: same type, not archived, not inside the edited account's subtree.
  const subtree = new Set(edit ? flattenTree([edit]).map((n) => n.id) : [])
  const allowed = (n: AccountNode) => takesChildren(n) && !n.archived && !subtree.has(n.id) && (!edit || n.type === edit.type)
  // A group whose parent is not offered moves up to the nearest offered ancestor.
  const groupTree = (nodes: AccountNode[]): CascaderNode[] => nodes.flatMap((n) => {
    const kids = groupTree(n.children)
    if (!allowed(n)) return kids
    return [{ value: String(n.id), label: n.label, children: kids.length ? kids : undefined }]
  })
  const groups = groupTree(roots)

  const create = useWrite('accounts.create')
  const update = useWrite('accounts.update')
  const save = edit ? update : create

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const done = { onSuccess: onClose }
    if (!edit) {
      create.mutate({ parent: parentId, name: name.trim(), currency, placeholder, owner: ownerId ? Number(ownerId) : null }, done)
      return
    }
    update.mutate({
      id: edit.id,
      ...(name.trim() !== edit.name && { name: name.trim() }),
      ...(parentId !== edit.parent && { parent: parentId }),
      ...(currency !== edit.currency && { currency }),
      ...(placeholder !== edit.placeholder && { placeholder }),
      ...(Number(ownerId || 0) !== (edit.owner ?? 0) && { owner: ownerId ? Number(ownerId) : null }),
    }, done)
  }

  return (
    <form onSubmit={onSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) e.currentTarget.requestSubmit() }}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="acc-parent">{t('coa.parent')}</FieldLabel>
          <Cascader items={groups} value={parentId ? String(parentId) : ''} onValueChange={(v) => {
            setParentId(Number(v) || 0)
            const p = v ? byId.get(Number(v)) : undefined
            if (!edit && p) { setCurrency(p.currency); setOwnerId(String(p.owner ?? '')) }
          }}>
            <CascaderTrigger id="acc-parent" aria-label={t('coa.parent')} render={<Button variant="outline" className="w-full justify-between font-normal" />}>
              <CascaderValue placeholder={t('coa.pickParent')} className="min-w-0 flex-1 truncate" />
            </CascaderTrigger>
            <CascaderContent className="w-(--anchor-width) min-w-80">
              <CascaderPanel>
                <CascaderNav><CascaderInput placeholder={t('coa.search')} /></CascaderNav>
                <CascaderBreadcrumb />
                <CascaderEmpty />
                <CascaderList><CascaderItems /></CascaderList>
                <CascaderStatus />
              </CascaderPanel>
            </CascaderContent>
          </Cascader>
          {!edit && <FieldDescription>{t('coa.parentHint')}</FieldDescription>}
        </Field>
        <Field>
          <FieldLabel htmlFor="acc-name">{t('coa.name')}</FieldLabel>
          <Input id="acc-name" required maxLength={200} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field className="w-40">
          <FieldLabel htmlFor="acc-currency">{t('coa.currency')}</FieldLabel>
          <OptionSelect
            id="acc-currency" value={currency} onChange={setCurrency} disabled={used}
            options={currencies.map((c) => ({ value: c, label: c }))}
          />
        </Field>
        {used && <FieldDescription className="-mt-4">{t('coa.usedHint')}</FieldDescription>}
        <Field className="w-56">
          <FieldLabel htmlFor="acc-owner">{t('scope.owner')}</FieldLabel>
          <OptionSelect
            id="acc-owner" value={ownerId} onChange={setOwnerId}
            options={[{ value: '', label: t('scope.shared') }, ...members.map((m) => ({ value: String(m.id), label: m.name }))]}
          />
          <FieldDescription>{t('scope.ownerHint')}</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="acc-placeholder" checked={placeholder} onCheckedChange={(v) => setPlaceholder(v === true)} disabled={used && !placeholder} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="acc-placeholder">{t('coa.placeholder')}</FieldLabel>
            <FieldDescription>{t('coa.placeholderHint')}</FieldDescription>
          </div>
        </Field>

        <div className="flex flex-col gap-1.5 border-t pt-4" aria-live="polite">
          <span className="text-xs font-medium text-muted-foreground">{t('coa.preview')}</span>
          <div className="flex items-center gap-2 text-sm">
            <span className={cn('min-w-0 flex-1 truncate', !parent && !name.trim() && 'text-muted-foreground')}>
              {parent ? `${parent.path ? `${parent.path} › ` : ''}${parent.label} › ` : ''}
              <span className="font-medium">{name.trim() || t('coa.name')}</span>
            </span>
            {parent && <Badge variant="outline">{t(`ledger.type.${parent.type}`)}</Badge>}
            {placeholder ? <Badge variant="info-light">{t('coa.placeholder')}</Badge> : <Badge variant="outline">{currency}</Badge>}
          </div>
        </div>
        {save.error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(save.error)}</AlertDescription></Alert>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={save.isPending || !name.trim() || !parentId}>
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}
