import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MemberAvatar } from '@/components/coa/OwnerAvatars'
import { OptionSelect } from '@/components/OptionSelect'
import { FormError } from '@/components/PageShell'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Spinner } from '@/components/ui/spinner'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { flattenTree, type AccountNode, type Member } from '@/lib/ledger'
import { cn } from '@/lib/utils'

export type AccountTarget =
  | { mode: 'create'; parent: AccountNode | null }
  | { mode: 'edit'; node: AccountNode }

type Props = {
  target: AccountTarget | null
  roots: AccountNode[]
  members: Member[]
  currencies: string[]
  baseCurrency: string
  onClose: () => void
  onSaved: () => void
}

// New / edit account. The system sets the frame: the user picks the group (Nakit, Banka, Kredi Kartı, Gider ...)
// and the account takes its type and kind. Code and kind are not asked.
export function AccountDialog({ target, ...rest }: Props) {
  const { t } = useTranslation()
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) rest.onClose() }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{target?.mode === 'edit' ? t('coa.editTitle') : t('coa.newTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('coa.title')}</DialogDescription>
        </DialogHeader>
        {target && <Form key={target.mode === 'edit' ? target.node.id : (target.parent?.id ?? 'root')} target={target} {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

function Form({ target, roots, members, currencies, baseCurrency, onClose, onSaved }: Props & { target: AccountTarget }) {
  const { t } = useTranslation()
  const edit = target.mode === 'edit' ? target.node : null
  const initialParent = edit ? edit.parent_id : target.mode === 'create' ? (target.parent?.id ?? null) : null
  const all = flattenTree(roots)
  const byId = new Map(all.map((n) => [n.id, n]))

  const [name, setName] = useState(edit?.name ?? '')
  const [parentId, setParentId] = useState(initialParent ?? '')
  const parent = parentId ? byId.get(parentId) : undefined
  const [currency, setCurrency] = useState(edit?.currency ?? parent?.currency ?? baseCurrency)
  const [owner, setOwner] = useState(edit?.owner_member_id ?? '')
  const [placeholder, setPlaceholder] = useState(edit?.is_placeholder ?? false)
  const used = !!edit && edit.net !== 0
  const subtype = edit?.subtype ?? parent?.subtype ?? null

  // Groups to choose from: the group accounts (placeholders) and the account the user started from.
  // A parent has the same type; an account cannot move under itself or its subtree.
  const subtree = new Set(edit ? flattenTree([edit]).map((n) => n.id) : [])
  const allowed = (n: AccountNode) => !n.archived_at && !n.system_key && !subtree.has(n.id) && (!edit || n.type === edit.type)
    && (n.is_placeholder || n.id === initialParent)
  // Group tree for the cascader: a group whose parent is not offered moves up to the nearest offered ancestor.
  const groupTree = (nodes: AccountNode[]): CascaderNode[] => nodes.flatMap((n) => {
    const kids = groupTree(n.children)
    if (!allowed(n)) return kids
    return [{
      value: n.id, label: n.name, children: kids.length ? kids : undefined,
      description: n.subtype ? t(`ledger.subtype.${n.subtype}`) : undefined,
    }]
  })
  const groups = groupTree(roots)
  const groupName = (id: string) => {
    const n = byId.get(id)
    return n ? (n.path ? `${n.path} › ${n.name}` : n.name) : ''
  }

  function pickParent(id: string) {
    setParentId(id)
    const p = byId.get(id)
    if (!edit && p) setCurrency(p.currency)
  }

  const save = useMutation({
    mutationFn: () => {
      if (edit) {
        const changed = <K extends string>(k: K, v: unknown, old: unknown) => (v !== old ? { [k]: v } : {})
        return callFunction('account-update', {
          account_id: edit.id,
          ...changed('name', name.trim(), edit.name),
          ...changed('parent_id', parentId || null, edit.parent_id),
          ...changed('currency', currency, edit.currency),
          ...changed('owner_member_id', owner || null, edit.owner_member_id),
          ...changed('is_placeholder', placeholder, edit.is_placeholder),
        })
      }
      return callFunction('account-create', {
        name: name.trim(),
        parent_id: parentId,
        currency,
        owner_member_id: owner || undefined,
        is_placeholder: placeholder,
      })
    },
    onSuccess: () => { onSaved(); onClose() },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const locked = !!edit?.locked
  const ownerMember = members.find((m) => m.id === owner)
  const typeKey = (edit?.type ?? parent?.type) as AccountNode['type'] | undefined
  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="acc-parent">{t('coa.parent')}</FieldLabel>
          <Cascader
            items={groups} value={parentId} onValueChange={(v) => pickParent(v ?? '')} selectable={(n) => !n.children?.length} disabled={locked}
          >
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
          <FieldLabel htmlFor="acc-name">{t('ledger.name')}</FieldLabel>
          <Input
            id="acc-name" required maxLength={80} autoFocus value={name} disabled={locked}
            onChange={(e) => setName(e.target.value)}
          />
          {locked && <FieldDescription>{t('coa.locked')}</FieldDescription>}
        </Field>
        <div className="grid grid-cols-[10rem_1fr] gap-4">
          <Field>
            <FieldLabel htmlFor="acc-currency">{t('ledger.currency')}</FieldLabel>
            <OptionSelect
              id="acc-currency" value={currency} onChange={setCurrency} disabled={used}
              options={currencies.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field>
            <FieldLabel>{t('ledger.owner')}</FieldLabel>
            <ToggleGroup
              variant="outline" size="sm" spacing={1} className="flex-wrap"
              value={[owner]} onValueChange={(v) => setOwner(v[0] ?? '')}
            >
              <ToggleGroupItem value="" aria-label={t('ledger.none')}>{t('ledger.none')}</ToggleGroupItem>
              {members.map((m) => (
                <ToggleGroupItem key={m.id} value={m.id} aria-label={m.name} className="gap-1.5">
                  <MemberAvatar member={m} />{m.name.split(' ')[0]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </div>
        {used && <FieldDescription className="-mt-4">{t('coa.usedHint')}</FieldDescription>}
        {!locked && (
          <Field orientation="horizontal">
            <Checkbox id="acc-placeholder" checked={placeholder} onCheckedChange={(v) => setPlaceholder(v === true)} disabled={used && !placeholder} />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="acc-placeholder">{t('coa.placeholder')}</FieldLabel>
              <FieldDescription>{t('coa.placeholderHint')}</FieldDescription>
            </div>
          </Field>
        )}

        <div className="flex flex-col gap-1.5 border-t pt-4" aria-live="polite">
          <span className="text-xs font-medium text-muted-foreground">{t('coa.preview')}</span>
          <div className="flex items-center gap-2 text-sm">
            <span className={cn('min-w-0 flex-1 truncate', !parentId && !name.trim() && 'text-muted-foreground')}>
              {parentId ? `${groupName(parentId)} › ` : ''}
              <span className="font-medium">{name.trim() || t('ledger.name')}</span>
            </span>
            {typeKey && <Badge variant="outline">{t(`ledger.type.${typeKey}`)}</Badge>}
            {subtype && <Badge variant="outline">{t(`ledger.subtype.${subtype}`)}</Badge>}
            {placeholder ? <Badge variant="info-light">{t('coa.placeholder')}</Badge> : <Badge variant="outline">{currency}</Badge>}
            {ownerMember && <MemberAvatar member={ownerMember} />}
          </div>
        </div>
        <FormError message={save.error ? errorMessage(t, save.error) : null} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('ledger.cancel')}</Button>
          <Button type="submit" disabled={save.isPending || !name.trim() || !parentId}>
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t('ledger.save')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}
