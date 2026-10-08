import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { OptionSelect } from '@/components/OptionSelect'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { flattenTree, type AccountNode, type Member } from '@/lib/ledger'

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
      <DialogContent className="sm:max-w-lg">
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
  const parentOptions = all
    .filter((n) => !n.archived_at && !n.system_key && !subtree.has(n.id) && (!edit || n.type === edit.type)
      && (n.is_placeholder || n.id === initialParent))
    .map((n) => ({ value: n.id, label: n.path ? `${n.path} › ${n.name}` : n.name }))

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
  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="acc-name">{t('ledger.name')}</FieldLabel>
          <Input
            id="acc-name" required maxLength={80} autoFocus value={name} disabled={locked}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {locked && <FieldDescription className="-mt-4">{t('coa.locked')}</FieldDescription>}
        <Field>
          <FieldLabel htmlFor="acc-parent">{t('coa.parent')}</FieldLabel>
          <OptionSelect
            id="acc-parent" value={parentId} onChange={pickParent} disabled={locked}
            options={[...(parentId ? [] : [{ value: '', label: t('coa.pickParent') }]), ...parentOptions]}
          />
          {!edit && <FieldDescription>{t('coa.parentHint')}</FieldDescription>}
        </Field>
        {subtype && (
          <p className="-mt-2 text-sm text-muted-foreground">
            {t('coa.kind')}: {t(`ledger.subtype.${subtype}`)}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="acc-currency">{t('ledger.currency')}</FieldLabel>
            <OptionSelect
              id="acc-currency" value={currency} onChange={setCurrency} disabled={used}
              options={currencies.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="acc-owner">{t('ledger.owner')}</FieldLabel>
            <OptionSelect
              id="acc-owner" value={owner} onChange={setOwner}
              options={[{ value: '', label: t('ledger.none') }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
            />
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
