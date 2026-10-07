import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FormError } from '@/components/PageShell'
import { OptionSelect } from '@/components/OptionSelect'
import { ResponsiveDialog } from '@/components/ResponsiveDialog'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { callFunction } from '@/lib/api'
import { descendantIds, flatten } from '@/lib/accountTree'
import { errorMessage } from '@/lib/errors'
import type { AccountNode } from './AccountTree'

export type FormTarget =
  | { mode: 'create'; section: 'accounts' | 'expense' | 'income'; parent: AccountNode | null }
  | { mode: 'edit'; section: 'accounts' | 'expense' | 'income'; node: AccountNode }

const SUBTYPES = ['cash', 'bank', 'credit_card', 'loan'] as const
const AMOUNT = '[0-9]+([.,][0-9]+)?'

type Props = {
  target: FormTarget | null
  tree: AccountNode[] // hedef bölümün ağacı (üst hesap seçimi için)
  currencies: string[]
  baseCurrency: string
  onClose: () => void
  onSaved: () => void
}

export function AccountFormDialog({ target, ...rest }: Props) {
  const { t } = useTranslation()
  const title = !target
    ? ''
    : target.mode === 'edit'
      ? t('accounts.editTitle')
      : target.parent
        ? t('accounts.newChildTitle', { parent: target.parent.name })
        : t(target.section === 'accounts' ? 'accounts.newTitle' : 'accounts.newCategoryTitle')
  return (
    <ResponsiveDialog open={!!target} onOpenChange={(o) => { if (!o) rest.onClose() }} title={title}>
      {/* key: hedef değişince form durumu sıfırlansın */}
      {target && <Form key={target.mode === 'edit' ? target.node.id : (target.parent?.id ?? target.section)} target={target} {...rest} />}
    </ResponsiveDialog>
  )
}

function Form({ target, tree, currencies, baseCurrency, onClose, onSaved }: Props & { target: FormTarget }) {
  const { t } = useTranslation()
  const edit = target.mode === 'edit' ? target.node : null
  const [name, setName] = useState(edit?.name ?? '')
  const [parentId, setParentId] = useState(edit ? (edit.parent_id ?? '') : (target.mode === 'create' ? (target.parent?.id ?? '') : ''))
  const [subtype, setSubtype] = useState<string>('bank')
  const [currency, setCurrency] = useState(baseCurrency)
  const [opening, setOpening] = useState('')
  const [rate, setRate] = useState('')

  const isCategory = target.section !== 'accounts'
  const parentNode = flatten(tree).find((n) => n.id === parentId) ?? null
  // Üst seçilince alt tür/para birimi üstten gelir.
  const inherited = !isCategory && !!parentNode
  const effSubtype = inherited ? (parentNode?.subtype ?? subtype) : subtype
  const effCurrency = inherited ? (parentNode?.currency ?? currency) : currency
  const isDebt = effSubtype === 'credit_card' || effSubtype === 'loan'

  const excluded = edit ? descendantIds(edit) : new Set<string>()
  const parentOptions = [
    { value: '', label: t('accounts.noParent') },
    ...flatten(tree)
      // Bilanço hesabında üst: aynı tip ve para birimi (DB trigger'ı da zorlar).
      .filter((n) => !excluded.has(n.id) && (!edit || isCategory || (n.type === edit.type && n.currency === edit.currency)))
      .map((n) => ({ value: n.id, label: `${'— '.repeat(n.depth)}${n.name}` })),
  ]

  const save = useMutation({
    mutationFn: () => {
      if (edit) {
        return callFunction('account-update', {
          account_id: edit.id,
          ...(name !== edit.name ? { name } : {}),
          ...(parentId !== (edit.parent_id ?? '') ? { parent_id: parentId || null } : {}),
        })
      }
      return callFunction('account-create', {
        name,
        parent_id: parentId || undefined,
        ...(isCategory ? { type: target.section } : { subtype: effSubtype, currency: effCurrency }),
        opening_balance: !isCategory ? opening.replace(',', '.') || undefined : undefined,
        rate: !isCategory ? rate.replace(',', '.') || undefined : undefined,
      })
    },
    onSuccess: () => { onSaved(); onClose() },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="acc-name">{t('accounts.name')}</FieldLabel>
          <Input
            id="acc-name" required maxLength={60} autoFocus={!edit} value={name}
            placeholder={t('accounts.namePlaceholder')} onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {(parentOptions.length > 1 || edit) && (
          <Field>
            <FieldLabel htmlFor="acc-parent">{t('accounts.parent')}</FieldLabel>
            <OptionSelect id="acc-parent" value={parentId} onChange={setParentId} options={parentOptions} />
          </Field>
        )}
        {!edit && !isCategory && !inherited && (
          <>
            <Field>
              <FieldLabel htmlFor="acc-kind">{t('accounts.kind')}</FieldLabel>
              <OptionSelect
                id="acc-kind" value={subtype} onChange={setSubtype}
                options={SUBTYPES.map((s) => ({ value: s, label: t(`accounts.subtype.${s}`) }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="acc-currency">{t('accounts.currency')}</FieldLabel>
              <OptionSelect id="acc-currency" value={currency} onChange={setCurrency} options={currencies.map((c) => ({ value: c, label: c }))} />
            </Field>
          </>
        )}
        {!edit && !isCategory && (
          <>
            <Field>
              <FieldLabel htmlFor="acc-opening">{t(isDebt ? 'accounts.openingDebt' : 'accounts.opening')}</FieldLabel>
              <Input
                id="acc-opening" inputMode="decimal" autoComplete="off" pattern={AMOUNT}
                value={opening} onChange={(e) => setOpening(e.target.value)}
              />
            </Field>
            {effCurrency !== baseCurrency && opening && (
              <Field>
                <FieldLabel htmlFor="acc-rate">{t('accounts.rateHint', { from: effCurrency, to: baseCurrency })}</FieldLabel>
                <Input id="acc-rate" inputMode="decimal" autoComplete="off" pattern={AMOUNT} value={rate} onChange={(e) => setRate(e.target.value)} />
              </Field>
            )}
          </>
        )}
        <FormError message={save.error ? errorMessage(t, save.error) : null} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>{t('entry.cancel')}</Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t('entry.save')}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
