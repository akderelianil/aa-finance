import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { OptionCombobox } from '@/components/OptionCombobox'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useErrorText, useOp, useWrite } from '@/lib/api'
import { flattenTree, useAccountTree } from '@/lib/ledger'
import type { Contact, ContactKind } from '../../../core/api/contacts.ts'

export type ContactTarget = { mode: 'create' } | { mode: 'edit'; contact: Contact }
const KINDS: ContactKind[] = ['individual', 'brand', 'business']

type Props = { target: ContactTarget | null; contacts: Contact[]; onClose: () => void }

export function ContactDialog({ target, contacts, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <Dialog open={!!target} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target?.mode === 'edit' ? t('dir.edit') : t('dir.add')}</DialogTitle>
          <DialogDescription>{t('dir.subtitle')}</DialogDescription>
        </DialogHeader>
        {target && <ContactForm target={target} contacts={contacts} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ContactForm({ target, contacts, onClose }: { target: ContactTarget; contacts: Contact[]; onClose: () => void }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const editing = target.mode === 'edit' ? target.contact : null
  const [kind, setKind] = useState<ContactKind>(editing?.kind ?? 'individual')
  const [name, setName] = useState(editing?.name ?? '')
  const [partners, setPartners] = useState<number[]>(editing?.partners ?? [])
  const [income, setIncome] = useState(editing?.incomeAccount ? String(editing.incomeAccount) : '')
  const [expense, setExpense] = useState(editing?.expenseAccount ? String(editing.expenseAccount) : '')
  const [attempted, setAttempted] = useState(false)
  const create = useWrite('contacts.create', { inline: true })
  const update = useWrite('contacts.update', { inline: true })
  const pending = create.isPending || update.isPending

  const accounts = useOp('accounts.list', {})
  const { roots } = useAccountTree(accounts.data)
  const options = (type: 'income' | 'expense') =>
    flattenTree(roots).filter((a) => a.type === type && !a.placeholder && !a.archived).map((a) => ({ value: String(a.id), label: a.path ? `${a.path} › ${a.label}` : a.label }))
  const incomeOptions = useMemo(() => options('income'), [roots]) // eslint-disable-line react-hooks/exhaustive-deps
  const expenseOptions = useMemo(() => options('expense'), [roots]) // eslint-disable-line react-hooks/exhaustive-deps

  // A Brand links to Businesses and the other way round; a Person links to none.
  const partnerKind: ContactKind | null = kind === 'brand' ? 'business' : kind === 'business' ? 'brand' : null
  const candidates = partnerKind ? contacts.filter((c) => c.kind === partnerKind) : []
  const nameError = name.trim() ? null : t('check.nameRequired')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (nameError) { setAttempted(true); return }
    const accountsInput = { incomeAccount: income ? Number(income) : null, expenseAccount: expense ? Number(expense) : null }
    if (editing) update.mutate({ id: editing.id, name: name.trim(), partners: partnerKind ? partners : undefined, ...accountsInput }, { onSuccess: onClose })
    else create.mutate({ kind, name: name.trim(), partners: partnerKind ? partners : undefined, ...accountsInput }, { onSuccess: onClose })
  }

  const error = create.error ?? update.error
  return (
    <form onSubmit={onSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.currentTarget.requestSubmit() }}>
      <FieldGroup>
        <Field>
          <FieldLabel>{t('dir.kindLabel')}</FieldLabel>
          <ToggleGroup
            value={[kind]} spacing={2} className="grid w-full grid-cols-3" aria-label={t('dir.kindLabel')} disabled={!!editing}
            onValueChange={(v) => { if (v[0]) { setKind(v[0] as ContactKind); setPartners([]) } }}
          >
            {KINDS.map((k) => <ToggleGroupItem key={k} value={k} variant="outline" size="sm">{t(`dir.kind.${k}`)}</ToggleGroupItem>)}
          </ToggleGroup>
          {editing && <FieldDescription>{t('dir.kindFixed')}</FieldDescription>}
        </Field>
        <Field>
          <FieldLabel htmlFor="contact-name">{t('dir.name')}</FieldLabel>
          <Input
            id="contact-name" autoFocus maxLength={200} value={name} aria-invalid={(attempted && !!nameError) || undefined}
            onChange={(e) => setName(e.target.value)}
          />
          {attempted && nameError && <FieldDescription className="text-destructive">{nameError}</FieldDescription>}
        </Field>
        {partnerKind && (
          <Field>
            <FieldLabel>{t(kind === 'brand' ? 'dir.linksBrand' : 'dir.linksBusiness')}</FieldLabel>
            {candidates.length ? (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border p-2">
                {candidates.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={partners.includes(c.id)}
                      onCheckedChange={(on) => setPartners((all) => (on ? [...all, c.id] : all.filter((x) => x !== c.id)))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            ) : <FieldDescription>{t('dir.noLinks')}</FieldDescription>}
          </Field>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="contact-income">{t('dir.income')}</FieldLabel>
            <OptionCombobox id="contact-income" value={income} onChange={setIncome} placeholder={t('dir.none')} options={incomeOptions} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-expense">{t('dir.expense')}</FieldLabel>
            <OptionCombobox id="contact-expense" value={expense} onChange={setExpense} placeholder={t('dir.none')} options={expenseOptions} />
          </Field>
          <FieldDescription className="col-span-2">{t('dir.defaultsHint')}</FieldDescription>
        </div>
        {error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(error)}</AlertDescription></Alert>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}
