import { useMutation, useQuery } from '@tanstack/react-query'
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
import {
  ACCOUNT_TYPES, flattenTree, SUBTYPES, type AccountNode, type AccountType, type Member,
} from '@/lib/ledger'
import { supabase } from '@/lib/supabase'

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

// GnuCash "New Account" / "Edit Account": name, code, parent, type, kind, currency, owner, placeholder.
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
  const [code, setCode] = useState(edit?.code ?? '')
  const [parentId, setParentId] = useState(initialParent ?? '')
  const parent = parentId ? byId.get(parentId) : undefined
  const [rootType, setRootType] = useState<AccountType>(edit?.type ?? 'asset')
  const type: AccountType = edit?.type ?? parent?.type ?? rootType
  const [subtype, setSubtype] = useState(edit?.subtype ?? parent?.subtype ?? '')
  const [currency, setCurrency] = useState(edit?.currency ?? parent?.currency ?? baseCurrency)
  const [owner, setOwner] = useState(edit?.owner_member_id ?? '')
  const [placeholder, setPlaceholder] = useState(edit?.is_placeholder ?? false)
  const [statementDay, setStatementDay] = useState<string | undefined>(undefined)
  const [dueDay, setDueDay] = useState<string | undefined>(undefined)
  const used = !!edit && edit.net !== 0

  // A parent has the same type; an account cannot move under itself or its subtree. System accounts are no parent.
  const subtree = new Set(edit ? flattenTree([edit]).map((n) => n.id) : [])
  const parentOptions = [
    { value: '', label: t('coa.noParent') },
    ...all
      .filter((n) => !n.archived_at && !n.system_key && !subtree.has(n.id) && (!edit || n.type === edit.type))
      .map((n) => ({ value: n.id, label: `${' '.repeat(n.depth)}${n.code}  ${n.name}` })),
  ]
  const isCard = subtype === 'credit_card'
  const card = useQuery({
    queryKey: ['card-settings', edit?.id],
    enabled: !!edit && isCard,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_card_settings').select('statement_day, due_day').eq('account_id', edit!.id).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const stmt = statementDay ?? card.data?.statement_day?.toString() ?? ''
  const due = dueDay ?? card.data?.due_day?.toString() ?? ''

  function pickParent(id: string) {
    setParentId(id)
    const p = byId.get(id)
    if (!edit && p) {
      setCurrency(p.currency)
      if (p.subtype) setSubtype(p.subtype)
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const cardDays = isCard && (statementDay !== undefined || dueDay !== undefined)
        ? { statement_day: stmt || null, due_day: due || null } : {}
      if (edit) {
        const changed = <K extends string>(k: K, v: unknown, old: unknown) => (v !== old ? { [k]: v } : {})
        return callFunction('account-update', {
          account_id: edit.id,
          ...changed('name', name.trim(), edit.name),
          ...changed('code', code.trim(), edit.code),
          ...changed('parent_id', parentId || null, edit.parent_id),
          ...changed('subtype', subtype || null, edit.subtype),
          ...changed('currency', currency, edit.currency),
          ...changed('owner_member_id', owner || null, edit.owner_member_id),
          ...changed('is_placeholder', placeholder, edit.is_placeholder),
          ...cardDays,
        })
      }
      return callFunction('account-create', {
        name: name.trim(),
        code: code.trim() || undefined,
        parent_id: parentId || undefined,
        type: parentId ? undefined : rootType,
        subtype: subtype || undefined,
        currency,
        owner_member_id: owner || undefined,
        is_placeholder: placeholder,
        ...cardDays,
      })
    },
    onSuccess: () => { onSaved(); onClose() },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const kinds = SUBTYPES[type]
  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <Field>
            <FieldLabel htmlFor="acc-code">{t('ledger.code')}</FieldLabel>
            <Input
              id="acc-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={30}
              pattern="[0-9]+(\.[0-9]+)*" className="font-mono" autoComplete="off"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="acc-name">{t('ledger.name')}</FieldLabel>
            <Input id="acc-name" required maxLength={80} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        {!edit && <FieldDescription className="-mt-4">{t('coa.codeHint')}</FieldDescription>}
        <Field>
          <FieldLabel htmlFor="acc-parent">{t('coa.parent')}</FieldLabel>
          <OptionSelect id="acc-parent" value={parentId} onChange={pickParent} options={parentOptions} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="acc-type">{t('coa.type')}</FieldLabel>
            <OptionSelect
              id="acc-type" value={type} disabled={!!edit || !!parent}
              onChange={(v) => { setRootType(v as AccountType); setSubtype('') }}
              options={ACCOUNT_TYPES.map((x) => ({ value: x, label: t(`ledger.type.${x}`) }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="acc-kind">{t('coa.kind')}</FieldLabel>
            <OptionSelect
              id="acc-kind" value={subtype} onChange={setSubtype} disabled={kinds.length === 0}
              options={[{ value: '', label: t('coa.kindNone') }, ...kinds.map((k) => ({ value: k, label: t(`ledger.subtype.${k}`) }))]}
            />
          </Field>
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
        <Field orientation="horizontal">
          <Checkbox id="acc-placeholder" checked={placeholder} onCheckedChange={(v) => setPlaceholder(v === true)} disabled={used && !placeholder} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="acc-placeholder">{t('coa.placeholder')}</FieldLabel>
            <FieldDescription>{t('coa.placeholderHint')}</FieldDescription>
          </div>
        </Field>
        {isCard && (
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="acc-stmt">{t('coa.statementDay')}</FieldLabel>
              <Input id="acc-stmt" type="number" min={1} max={31} value={stmt} onChange={(e) => setStatementDay(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="acc-due">{t('coa.dueDay')}</FieldLabel>
              <Input id="acc-due" type="number" min={1} max={31} value={due} onChange={(e) => setDueDay(e.target.value)} />
            </Field>
          </div>
        )}
        <FormError message={save.error ? errorMessage(t, save.error) : null} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('ledger.cancel')}</Button>
          <Button type="submit" disabled={save.isPending || !name.trim()}>
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t('ledger.save')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}
