import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { AccountPicker } from '@/components/journal/AccountPicker'
import { ContactPicker } from '@/components/journal/ContactPicker'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { useContacts, type Contact } from '@/lib/contacts'
import { errorMessage } from '@/lib/errors'
import { today } from '@/lib/journal'
import { flattenTree, formatAmount, parseDecimalInput, toMinor, useCurrencies, useLedgerAccounts, type AccountNode } from '@/lib/ledger'
import {
  convertMinor, incomeExpenseLines, isBank, isCard, isCash, transferLines, type FxCtx, type QuickLine,
} from '@/lib/quick'

export type QuickKind = 'income' | 'expense' | 'transfer' | 'debt'
type Kind = QuickKind
type TransferMode = 'between' | 'atm_withdraw' | 'atm_deposit'
type DebtMode = 'borrow' | 'lend'

type Props = { kind: QuickKind | null; onClose: () => void; membership: Membership }

// Hızlı İşlem: Gelir · Gider · Transfer · Borç (alma / verme). Each form posts one plain journal entry through journal-post.
// Borç needs a Rehber contact: Borç Alma = Borç money / Alacak Kişilere Borçlar, Borç Verme = Borç Kişilerden Alacaklar / Alacak money.
// A Rehber contact tags every line; for Gelir / Gider its default account fills the first account line.
export function QuickTransactionDialog({ kind, onClose, membership }: Props) {
  const { t } = useTranslation()
  return (
    <Dialog open={kind !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('quick.title')}</DialogTitle>
          <DialogDescription>{t('quick.subtitle')}</DialogDescription>
        </DialogHeader>
        {kind && <QuickForm key={kind} initialKind={kind} membership={membership} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

type SplitDraft = { key: number; accountId: string; memo: string; amount: string }
let nextKey = 1
const emptySplit = (): SplitDraft => ({ key: nextKey++, accountId: '', memo: '', amount: '' })

function QuickForm({ initialKind, membership, onClose }: { initialKind: Kind; membership: Membership; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const base = membership.group.base_currency
  const accounts = useLedgerAccounts()
  const currencies = useCurrencies()
  const exponents = useMemo(() => new Map((currencies.data ?? []).map((c) => [c.code, c.exponent])), [currencies.data])
  const expOf = (cur: string) => exponents.get(cur) ?? 2
  const postable = useMemo(
    () => flattenTree(accounts.data?.roots ?? []).filter((a) => !a.is_placeholder && !a.archived_at),
    [accounts.data],
  )
  const byId = accounts.data?.byId ?? new Map<string, AccountNode>()
  const acc = (id: string) => (id ? byId.get(id) : undefined)

  const [kind, setKind] = useState<Kind>(initialKind)
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  const contacts = useContacts()
  const activeContacts = useMemo(() => (contacts.data ?? []).filter((c) => !c.archived_at), [contacts.data])
  const [contactId, setContactId] = useState('')
  const [autoAccount, setAutoAccount] = useState('') // the account line the contact default filled in
  // Gelir / Gider
  const [moneyId, setMoneyId] = useState('')
  const [splits, setSplits] = useState<SplitDraft[]>([emptySplit()])
  const [moneyAmount, setMoneyAmount] = useState('')
  // Transfer
  const [mode, setMode] = useState<TransferMode>('between')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [counter, setCounter] = useState('')
  const [fee, setFee] = useState('')
  const [feeAccountId, setFeeAccountId] = useState('')
  // Borç
  const [debtMode, setDebtMode] = useState<DebtMode>('borrow')

  const balanceSheet = postable.filter((a) => a.type === 'asset' || a.type === 'liability')
  const categories = postable.filter((a) => a.type === kind)
  const expenses = postable.filter((a) => a.type === 'expense')
  const fromList = mode === 'atm_withdraw' ? balanceSheet.filter((a) => isBank(a) || isCard(a))
    : mode === 'atm_deposit' ? balanceSheet.filter(isCash) : balanceSheet
  const toList = mode === 'atm_withdraw' ? balanceSheet.filter(isCash)
    : mode === 'atm_deposit' ? balanceSheet.filter(isBank) : balanceSheet
  const moneyAccounts = balanceSheet.filter((a) => a.type === 'asset' && a.subtype !== 'receivable')
  const debtAccount = balanceSheet.find((a) => a.subtype === (debtMode === 'borrow' ? 'payable' : 'receivable'))
  const defaultFee = expenses.find((a) => a.template_key === 'bank_fee')

  const money = acc(moneyId)
  const from = acc(fromId)
  const to = acc(toId)
  const feeAccount = acc(feeAccountId) ?? defaultFee

  // Day rates of the foreign currencies on the form (suggestions; journal-post books the given base amounts).
  const used = kind === 'transfer'
    ? [from?.currency, to?.currency, feeAccount?.currency]
    : kind === 'debt' ? [money?.currency, debtAccount?.currency]
    : [money?.currency, ...splits.map((s) => acc(s.accountId)?.currency)]
  const foreign = [...new Set(used.filter((c): c is string => !!c && c !== base))]
  const rates = useQueries({
    queries: foreign.map((currency) => ({
      queryKey: ['fx-rate', currency, date],
      queryFn: () => callFunction<{ rate: string }>('fx-rate', { currency, date }),
      retry: false,
      staleTime: 60 * 60 * 1000,
    })),
  })
  const rateOf = new Map(foreign.map((c, i) => [c, rates[i]?.data?.rate]))
  const fx: FxCtx = { base, exp: expOf, rate: (c) => (c === base ? '1' : rateOf.get(c)) }

  const minor = (s: string, cur: string) => {
    const v = parseDecimalInput(s, expOf(cur))
    return v ? toMinor(v, expOf(cur)) : 0
  }
  const fmt = (m: number, cur: string) => formatAmount(m, expOf(cur), i18n.language)

  // Gelir / Gider lines.
  const filledSplits = splits.filter((s) => s.accountId || s.amount)
  const splitRows = filledSplits.map((s) => {
    const a = acc(s.accountId)
    return a ? { account: a, amount: minor(s.amount, a.currency), memo: s.memo } : null
  })
  const mixed = !!money && splitRows.some((r) => r && r.account.currency !== money.currency)
  const splitsTotal = splitRows.reduce((sum, r) => sum + (r?.amount ?? 0), 0)
  const moneySuggest = money && mixed
    ? splitRows.reduce<number | null>((sum, r) => {
      const c = r ? convertMinor(fx, r.amount, r.account.currency, money.currency) : null
      return sum === null || c === null ? null : sum + c
    }, 0)
    : null
  const moneyMinor = money && mixed ? (moneyAmount ? minor(moneyAmount, money.currency) : moneySuggest) : null

  // Transfer lines.
  const differ = !!from && !!to && from.currency !== to.currency
  const amountMinor = from ? minor(amount, from.currency) : 0
  const counterSuggest = from && to && differ ? convertMinor(fx, amountMinor, from.currency, to.currency) : null
  const counterMinor = to && differ ? (counter ? minor(counter, to.currency) : counterSuggest) : null
  const feeMinor = from ? minor(fee, from.currency) : 0

  // Borç: the amount is in the money account currency; the debt account may use another one.
  const debtDiffer = !!money && !!debtAccount && money.currency !== debtAccount.currency
  const debtMinor = money ? minor(amount, money.currency) : 0
  const debtSuggest = money && debtAccount && debtDiffer ? convertMinor(fx, debtMinor, money.currency, debtAccount.currency) : null
  const debtCounter = debtAccount && debtDiffer ? (counter ? minor(counter, debtAccount.currency) : debtSuggest) : null

  let lines: QuickLine[] | null = null
  if (kind === 'debt') {
    if (money && debtAccount && contactId) {
      lines = debtMode === 'borrow'
        ? transferLines(fx, debtAccount, money, debtDiffer ? debtCounter ?? 0 : debtMinor, debtDiffer ? debtMinor : null, 0, null)
        : transferLines(fx, money, debtAccount, debtMinor, debtDiffer ? debtCounter : null, 0, null)
    }
  } else if (kind === 'transfer') {
    if (from && to) lines = transferLines(fx, from, to, amountMinor, counterMinor, feeMinor, feeAccount ?? null)
  } else if (money && splitRows.length > 0 && splitRows.every((r) => r)) {
    lines = incomeExpenseLines(fx, kind, money, splitRows as NonNullable<(typeof splitRows)[number]>[], moneyMinor)
  }
  const sameAccount = kind === 'transfer' && !!from && from.id === to?.id
  const badFeeAccount = kind === 'transfer' && feeMinor > 0 && !!feeAccount && !!from
    && feeAccount.currency !== from.currency && feeAccount.currency !== base

  // Default account of the contact for the kind; only a postable account of that type counts.
  const defaultFor = (c: Contact | undefined, k: Kind) => {
    const id = k === 'income' ? c?.default_income_account_id : k === 'expense' ? c?.default_expense_account_id : null
    return id && postable.some((a) => a.id === id && a.type === k) ? id : ''
  }
  function changeContact(id: string) {
    setContactId(id)
    if (kind === 'transfer' || kind === 'debt') return
    const def = defaultFor(activeContacts.find((c) => c.id === id), kind)
    const first = splits[0]
    // Replace the first account only while it is empty or still the previous contact's default.
    if (first && (!first.accountId || first.accountId === autoAccount)) {
      setSplits([{ ...first, accountId: def }, ...splits.slice(1)])
      setAutoAccount(def)
    }
  }

  const save = useMutation({
    mutationFn: () => callFunction<{ entry_id: string }>('journal-post', {
      action: 'create', date, description: description.trim(),
      lines: lines?.map((l) => (contactId ? { ...l, contact_id: contactId } : l)),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger'] })
      onClose()
    },
  })

  // ATM modes fill the description while it is empty or still the previous default.
  const atmText = (m: TransferMode) => (m === 'between' ? '' : t(`quick.mode.${m}`))
  function changeMode(m: TransferMode) {
    if (!description || description === atmText(mode)) setDescription(atmText(m))
    setMode(m)
    setFromId('')
    setToId('')
    setCounter('')
  }
  function changeKind(k: Kind) {
    setKind(k)
    const def = k === 'debt' ? '' : defaultFor(activeContacts.find((c) => c.id === contactId), k)
    setSplits([{ ...emptySplit(), accountId: def }])
    setAutoAccount(def)
    setMoneyAmount('')
    setMoneyId('')
    setAmount('')
    setCounter('')
    if (k === 'transfer') changeMode(mode)
    else if (description === atmText(mode)) setDescription('')
  }

  const setSplit = (key: number, patch: Partial<SplitDraft>) =>
    setSplits((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const amountCls = 'h-8 text-right font-mono tabular-nums'
  const moneyLabel = kind === 'expense' ? t('quick.paidFrom') : t('quick.paidTo')
  const splitLabel = kind === 'expense' ? t('quick.expenseAccount') : t('quick.incomeAccount')

  return (
    <div
      className="flex flex-col gap-4"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && lines && !save.isPending) {
          e.preventDefault()
          save.mutate()
        }
      }}
    >
      <Tabs value={kind} onValueChange={(v) => changeKind(v as Kind)}>
        <TabsList>
          <TabsTrigger value="income">{t('quick.kind.income')}</TabsTrigger>
          <TabsTrigger value="expense">{t('quick.kind.expense')}</TabsTrigger>
          <TabsTrigger value="transfer">{t('quick.kind.transfer')}</TabsTrigger>
          <TabsTrigger value="debt">{t('quick.kind.debt')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {kind === 'transfer' && (
        <ToggleGroup
          value={[mode]} spacing={2} className="grid w-full grid-cols-3" aria-label={t('quick.kind.transfer')}
          onValueChange={(v) => { if (v[0]) changeMode(v[0] as TransferMode) }}
        >
          {(['between', 'atm_withdraw', 'atm_deposit'] as const).map((m) => (
            <ToggleGroupItem key={m} value={m} variant="outline" size="sm">{t(`quick.mode.${m}`)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {kind === 'debt' && (
        <ToggleGroup
          value={[debtMode]} spacing={2} className="grid w-full grid-cols-2" aria-label={t('quick.kind.debt')}
          onValueChange={(v) => { if (v[0]) { setDebtMode(v[0] as DebtMode); setCounter('') } }}
        >
          {(['borrow', 'lend'] as const).map((m) => (
            <ToggleGroupItem key={m} value={m} variant="outline" size="sm">{t(`quick.debt.${m}`)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      <div className="flex items-end gap-3">
        <Field label={t('ledger.date')}>
          <Input type="date" className="h-8 w-40" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={kind === 'debt' ? t('quick.debt.person') : t('directory.field')} className="w-60">
          <ContactPicker
            contacts={activeContacts} value={contactId} onChange={changeContact} aria-label={t('directory.field')}
            className="rounded-3xl bg-input/50 px-1 text-foreground [&_input]:rounded-3xl"
          />
        </Field>
        <Field label={t('ledger.description')} className="flex-1">
          <Input className="h-8" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>

      {kind === 'debt' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={debtMode === 'borrow' ? t('quick.debt.receivedIn') : t('quick.debt.givenFrom')}>
              <Picker
                accounts={moneyAccounts} value={moneyId} onChange={setMoneyId} autoFocus
                label={debtMode === 'borrow' ? t('quick.debt.receivedIn') : t('quick.debt.givenFrom')}
              />
            </Field>
            <Field label={t('quick.amount')}>
              <AmountInput className={amountCls} value={amount} currency={money?.currency} base={base} onChange={setAmount} />
            </Field>
          </div>
          {debtDiffer && debtAccount && (
            <Field label={t('quick.debt.debtAmount', { currency: debtAccount.currency })} className="w-1/2 pr-1.5">
              <AmountInput
                className={amountCls} value={counter} currency={debtAccount.currency} base={base}
                placeholder={debtSuggest ? fmt(debtSuggest, debtAccount.currency) : ''}
                onChange={setCounter}
              />
            </Field>
          )}
        </>
      ) : kind !== 'transfer' ? (
        <>
          <Field label={moneyLabel}>
            <Picker accounts={balanceSheet} value={moneyId} onChange={setMoneyId} label={moneyLabel} autoFocus />
          </Field>

          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="[&>th]:px-1 [&>th]:pb-1 [&>th]:text-left [&>th]:font-medium">
                <th className="w-[45%]">{splitLabel}</th>
                <th>{t('ledger.memo')}</th>
                <th className="w-40 !text-right">{t('quick.amount')}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {splits.map((s, i) => {
                const a = acc(s.accountId)
                return (
                  <tr key={s.key} className="[&>td]:px-1 [&>td]:py-0.5">
                    <td>
                      <Picker
                        accounts={categories} value={s.accountId} label={`${splitLabel} ${i + 1}`}
                        onChange={(id) => setSplit(s.key, { accountId: id })}
                      />
                    </td>
                    <td><Input className="h-8" maxLength={200} value={s.memo} onChange={(e) => setSplit(s.key, { memo: e.target.value })} /></td>
                    <td>
                      <AmountInput
                        className={amountCls} value={s.amount} currency={a?.currency} base={base} aria-label={t('quick.amount')}
                        onChange={(v) => setSplit(s.key, { amount: v })}
                      />
                    </td>
                    <td>
                      <Button
                        type="button" variant="ghost" size="icon-sm" aria-label={t('gj.removeLine')} tabIndex={-1}
                        disabled={splits.length <= 1}
                        onClick={() => setSplits((all) => all.filter((x) => x.key !== s.key))}
                      >
                        <Trash2Icon />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t [&>td]:px-1 [&>td]:pt-2">
                <td colSpan={2}>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSplits((all) => [...all, emptySplit()])}>
                    <PlusIcon data-icon="inline-start" />{t('quick.addAccount')}
                  </Button>
                </td>
                <td className="px-3 text-right font-mono font-semibold tabular-nums">
                  {!mixed && money && splits.length > 1 && fmt(splitsTotal, money.currency)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>

          {mixed && money && (
            <Field label={kind === 'expense' ? t('quick.moneyOut', { currency: money.currency }) : t('quick.moneyIn', { currency: money.currency })}>
              <AmountInput
                className={`${amountCls} w-48`} value={moneyAmount} currency={money.currency} base={base}
                placeholder={moneySuggest !== null ? fmt(moneySuggest, money.currency) : ''}
                onChange={setMoneyAmount}
              />
            </Field>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('quick.from')}>
              <Picker accounts={fromList} value={fromId} onChange={setFromId} label={t('quick.from')} autoFocus />
            </Field>
            <Field label={t('quick.to')}>
              <Picker accounts={toList} value={toId} onChange={setToId} label={t('quick.to')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('quick.amount')}>
              <AmountInput className={amountCls} value={amount} currency={from?.currency} base={base} onChange={setAmount} />
            </Field>
            {differ && to && (
              <Field label={t('quick.counterAmount', { currency: to.currency })}>
                <AmountInput
                  className={amountCls} value={counter} currency={to.currency} base={base}
                  placeholder={counterSuggest ? fmt(counterSuggest, to.currency) : ''}
                  onChange={setCounter}
                />
              </Field>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('quick.fee')}>
              <AmountInput className={amountCls} value={fee} currency={from?.currency} base={base} onChange={setFee} />
            </Field>
            <Field label={t('quick.feeAccount')}>
              <Picker accounts={expenses} value={feeAccount?.id ?? ''} onChange={setFeeAccountId} label={t('quick.feeAccount')} />
            </Field>
          </div>
        </>
      )}

      {lines && <Preview lines={lines} byId={byId} base={base} fmt={(d, cur) => fmt(toMinor(d, expOf(cur)), cur)} />}

      <div className="flex items-center gap-3">
        <FormError
          message={save.error ? errorMessage(t, save.error)
            : kind === 'debt' && !contactId ? t('quick.debt.needPerson')
              : sameAccount ? t('quick.sameAccount')
              : badFeeAccount ? t('quick.feeCurrency') : null}
        />
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>{t('ledger.cancel')}</Button>
          <Button type="button" disabled={!lines || save.isPending} onClick={() => save.mutate()} title="Ctrl+Enter">
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t('ledger.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-muted-foreground ${className ?? ''}`}>
      {label}
      {children}
    </label>
  )
}

function Picker({ accounts, value, onChange, label, autoFocus }: {
  accounts: AccountNode[]; value: string; onChange: (id: string) => void; label: string; autoFocus?: boolean
}) {
  return (
    <AccountPicker
      accounts={accounts} value={value} onChange={onChange} autoFocus={autoFocus} aria-label={label}
      className="rounded-3xl bg-input/50 px-1 text-foreground [&_input]:rounded-3xl"
    />
  )
}

function AmountInput({ currency, base, onChange, ...rest }: {
  value: string; currency?: string; base: string; className?: string; placeholder?: string
  onChange: (v: string) => void; 'aria-label'?: string
}) {
  return (
    <div className="relative">
      <Input inputMode="decimal" {...rest} onChange={(e) => onChange(e.target.value)} />
      {currency && currency !== base && (
        <span className="pointer-events-none absolute top-2 left-2 text-[10px] text-muted-foreground">{currency}</span>
      )}
    </div>
  )
}

// The journal entry the form will post (Borç / Alacak), so the user sees the booking before saving.
function Preview({ lines, byId, base, fmt }: {
  lines: QuickLine[]; byId: Map<string, AccountNode>; base: string; fmt: (decimal: string, cur: string) => string
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{t('quick.preview')}</div>
      <table className="w-full">
        <thead className="text-xs text-muted-foreground">
          <tr className="[&>th]:px-1 [&>th]:text-left [&>th]:font-medium">
            <th>{t('ledger.account')}</th>
            <th className="w-36 !text-right">{t('ledger.debit')}</th>
            <th className="w-36 !text-right">{t('ledger.credit')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const a = byId.get(l.account_id)
            const cur = a?.currency ?? base
            const cell = (side: 'debit' | 'credit') => (l.side === side
              ? <>{fmt(l.amount, cur)}{cur !== base && <span className="ml-1 text-xs text-muted-foreground">{cur}</span>}</>
              : '')
            return (
              <tr key={i} className="[&>td]:px-1 [&>td]:py-0.5">
                <td className={l.side === 'credit' ? 'pl-8' : ''}>
                  {a?.name}
                  {l.memo && <span className="ml-2 text-xs text-muted-foreground">{l.memo}</span>}
                </td>
                <td className="text-right font-mono tabular-nums">{cell('debit')}</td>
                <td className="text-right font-mono tabular-nums">{cell('credit')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
