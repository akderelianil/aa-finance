import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRightIcon, ArrowRightIcon, ChevronRightIcon, CircleAlertIcon, HandCoinsIcon, PlusIcon, Trash2Icon, TrendingDownIcon, TrendingUpIcon, TriangleAlertIcon, UserPlusIcon } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { AccountPicker } from '@/components/journal/AccountPicker'
import { AmountInput } from '@/components/journal/AmountInput'
import { ContactPicker } from '@/components/journal/ContactPicker'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { amountIssue, oneYearAgo } from '@/lib/entryRules'
import { useContactDebt, useContacts, type Contact } from '@/lib/contacts'
import { errorMessage } from '@/lib/errors'
import { today } from '@/lib/journal'
import { flattenTree, formatAmount, parseDecimalInput, toMinor, useCurrencies, useLedgerAccounts, type AccountNode } from '@/lib/ledger'
import {
  convertMinor, incomeExpenseLines, isBank, isCard, isCash, toBaseMinor, transferLines, type FxCtx, type QuickLine,
} from '@/lib/quick'

export type QuickKind = 'income' | 'expense' | 'transfer' | 'debt'
type Kind = QuickKind
type TransferMode = 'between' | 'atm_withdraw' | 'atm_deposit'
type DebtMode = 'borrow' | 'lend' | 'collect' | 'pay'
const DEBT_MODES = ['lend', 'borrow', 'collect', 'pay'] as const
const moneyIn = (m: DebtMode) => m === 'borrow' || m === 'collect'

type Props = { kind: QuickKind | null; onClose: () => void; membership: Membership }

// Hızlı İşlem: Gelir · Gider · Transfer · Borç (alma / verme). Each form posts one plain journal entry through journal-post.
// Borç needs a Rehber contact: Borç Alma = Borç money / Alacak Kişilere Borçlar, Borç Verme = Borç Kişilerden Alacaklar / Alacak money,
// Tahsilat = Borç money / Alacak Kişilerden Alacaklar, Ödeme = Borç Kişilere Borçlar / Alacak money.
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
  const [showBooking, setShowBooking] = useState(false)
  const [showContact, setShowContact] = useState(false)

  const balanceSheet = postable.filter((a) => a.type === 'asset' || a.type === 'liability')
  const categories = postable.filter((a) => a.type === kind)
  const expenses = postable.filter((a) => a.type === 'expense')
  const fromList = mode === 'atm_withdraw' ? balanceSheet.filter((a) => isBank(a) || isCard(a))
    : mode === 'atm_deposit' ? balanceSheet.filter(isCash) : balanceSheet
  const toList = mode === 'atm_withdraw' ? balanceSheet.filter(isCash)
    : mode === 'atm_deposit' ? balanceSheet.filter(isBank) : balanceSheet
  const moneyAccounts = balanceSheet.filter((a) => a.type === 'asset' && a.subtype !== 'receivable')
  const debtAccount = balanceSheet.find((a) => a.subtype === (debtMode === 'borrow' || debtMode === 'pay' ? 'payable' : 'receivable'))
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

  // Open balance of the chosen person on the debt account; Tahsilat / Ödeme above it is warned about.
  const debtOpen = useContactDebt(kind === 'debt' ? contactId : '', debtAccount?.subtype === 'payable' ? 'payable' : 'receivable')
  const debtSide = debtAccount?.currency ?? base
  const debtAmountMinor = debtDiffer ? debtCounter ?? 0 : debtMinor
  const debtAmountBase = debtAccount ? toBaseMinor(fx, debtAmountMinor, debtSide) : null
  const reducing = debtMode === 'collect' || debtMode === 'pay'
  const overpay = kind === 'debt' && reducing && debtOpen.data !== undefined && debtAmountBase !== null && debtAmountBase > debtOpen.data

  let lines: QuickLine[] | null = null
  if (kind === 'debt') {
    if (money && debtAccount && contactId) {
      lines = moneyIn(debtMode)
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

  // ---- Defensive checks: every blocking problem has a message; warnings never block. ----
  const [attempted, setAttempted] = useState(false)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [showFee, setShowFee] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const errs: Record<string, string> = {}
  const warns: Record<string, string> = {}
  const amtCheck = (raw: string, cur: string, required = true) => {
    if (!raw.trim()) return required ? t('check.amount_required') : null
    const i = amountIssue(raw, expOf(cur))
    return i ? t(`check.amount_${i}`, { count: expOf(cur) }) : null
  }
  const account = t('check.account')

  if (!date) errs.date = t('check.dateRequired')
  else if (date > today()) errs.date = t('check.dateFuture')
  else if (date < oneYearAgo()) warns.date = t('check.dateOld')

  const single = kind !== 'transfer' && kind !== 'debt' && splits.length === 1
  const heroMode = kind === 'transfer' || kind === 'debt' || single
  if (kind === 'debt') {
    if (!contactId) errs.person = t('quick.debt.needPerson')
    if (!money) errs.money = account
    const e = amtCheck(amount, money?.currency ?? base)
    if (e) errs.amount = e
    if (!debtAccount) errs.debtAccount = t('check.noDebtAccount', { kind: t(debtMode === 'borrow' || debtMode === 'pay' ? 'check.payable' : 'check.receivable') })
    if (debtDiffer && debtCounter === null) errs.counter = t('check.counter')
  } else if (kind === 'transfer') {
    if (!from) errs.from = account
    if (!to) errs.to = account
    else if (sameAccount) errs.to = t('quick.sameAccount')
    const e = amtCheck(amount, from?.currency ?? base)
    if (e) errs.amount = e
    if (differ && counterMinor === null) errs.counter = t('check.counter')
    else if (counter) { const c = amtCheck(counter, to?.currency ?? base, false); if (c) errs.counter = c }
    const fe = amtCheck(fee, from?.currency ?? base, false)
    if (fe) errs.fee = fe
    else if (feeMinor > 0 && !feeAccount) errs.feeAccount = t('check.feeAccount')
    if (badFeeAccount) errs.feeAccount = t('quick.feeCurrency')
    if (!errs.fee && feeMinor > 0 && amountMinor > 0 && feeMinor >= amountMinor) warns.fee = t('check.feeBig')
  } else {
    if (!money) errs.money = account
    splits.forEach((s, i) => {
      if (i > 0 && !s.accountId && !s.amount) return
      if (!s.accountId) errs[`acc${s.key}`] = account
      const e = amtCheck(s.amount, acc(s.accountId)?.currency ?? base)
      if (e) errs[`amt${s.key}`] = e
    })
    const seen = new Set<string>()
    for (const s of splits) {
      if (s.accountId && seen.has(s.accountId)) warns[`acc${s.key}`] = t('check.duplicate')
      seen.add(s.accountId)
    }
    if (mixed && money) {
      if (moneyAmount) { const e = amtCheck(moneyAmount, money.currency, false); if (e) errs.moneyAmount = e }
      else if (moneyMinor === null) errs.moneyAmount = t('check.counter')
    }
  }
  // Soft warning: the paying account would go below zero.
  const payerKey = kind === 'expense' ? 'money' : kind === 'transfer' ? 'from' : kind === 'debt' && !moneyIn(debtMode) ? 'money' : null
  const payer = payerKey === 'from' ? from : payerKey ? money : undefined
  const outMinor = kind === 'transfer' ? amountMinor + feeMinor : kind === 'debt' ? debtMinor : money && !mixed ? splitsTotal : moneyMinor ?? 0
  if (payerKey && payer && payer.type === 'asset' && outMinor > payer.net && !errs[payerKey]) {
    warns[payerKey] = t('check.lowBalance', { balance: fmt(payer.net, payer.currency), currency: payer.currency })
  }

  const errorCount = Object.keys(errs).length
  const blocking = errorCount > 0 || !lines
  const shown = (key: string) => (attempted || touched.has(key) ? errs[key] : undefined)
  const fieldProps = (key: string) => ({
    error: shown(key), warning: errs[key] ? undefined : warns[key],
    onTouch: () => setTouched((s) => (s.has(key) ? s : new Set(s).add(key))),
  })

  function submit() {
    if (save.isPending) return
    if (blocking) {
      setAttempted(true)
      setTimeout(() => rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 50)
      return
    }
    save.mutate()
  }

  const first = splits[0]
  const heroKey = kind === 'transfer' || kind === 'debt' ? 'amount' : `amt${first.key}`
  const heroValue = kind === 'transfer' || kind === 'debt' ? amount : first.amount
  const heroCur = kind === 'transfer' ? from?.currency : kind === 'debt' ? money?.currency : acc(first.accountId)?.currency
  const setHero = (v: string) => (kind === 'transfer' || kind === 'debt' ? setAmount(v) : setSplit(first.key, { amount: v }))
  const moneyLabel = kind === 'expense' ? t('quick.paidFrom') : t('quick.paidTo')
  const splitLabel = kind === 'expense' ? t('quick.expenseAccount') : t('quick.incomeAccount')
  const moneyField = (
    <Field label={moneyLabel} {...fieldProps('money')}>
      <Picker accounts={balanceSheet} value={moneyId} onChange={setMoneyId} label={moneyLabel} invalid={!!shown('money')} />
    </Field>
  )

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-4"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          submit()
        }
      }}
    >
      <Tabs value={kind} onValueChange={(v) => changeKind(v as Kind)}>
        <TabsList>
          <TabsTrigger value="income"><TrendingUpIcon />{t('quick.kind.income')}</TabsTrigger>
          <TabsTrigger value="expense"><TrendingDownIcon />{t('quick.kind.expense')}</TabsTrigger>
          <TabsTrigger value="transfer"><ArrowLeftRightIcon />{t('quick.kind.transfer')}</TabsTrigger>
          <TabsTrigger value="debt"><HandCoinsIcon />{t('quick.kind.debt')}</TabsTrigger>
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
        <>
          <ToggleGroup
            value={[debtMode]} spacing={2} className="grid w-full grid-cols-4" aria-label={t('quick.kind.debt')}
            onValueChange={(v) => { if (v[0]) { setDebtMode(v[0] as DebtMode); setCounter('') } }}
          >
            {DEBT_MODES.map((m) => (
              <ToggleGroupItem key={m} value={m} variant="outline" size="sm">{t(`quick.debt.${m}`)}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Field label={t('quick.debt.person')} {...fieldProps('person')}>
            <ContactPicker
              contacts={activeContacts} value={contactId} onChange={changeContact} aria-label={t('directory.field')} invalid={!!shown('person')}
              className="rounded-3xl bg-input/50 px-1 text-foreground [&_input]:rounded-3xl"
            />
          </Field>
          {errs.debtAccount && <p className="text-sm text-destructive" role="alert">{errs.debtAccount}</p>}
        </>
      )}

      {heroMode && (
        <Field label={t('quick.amount')} hint={t('check.amountHint')} {...fieldProps(heroKey)}>
          <AmountInput
            hero autoFocus value={heroValue} currency={heroCur ?? base} exponent={expOf(heroCur ?? base)}
            invalid={!!shown(heroKey)} placeholder="0,00" onChange={setHero}
          />
        </Field>
      )}

      {kind === 'transfer' && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <Field label={t('quick.from')} {...fieldProps('from')}>
            <Picker accounts={fromList} value={fromId} onChange={setFromId} label={t('quick.from')} invalid={!!shown('from')} />
          </Field>
          <ArrowRightIcon className="mt-7 size-4 text-muted-foreground" aria-hidden />
          <Field label={t('quick.to')} {...fieldProps('to')}>
            <Picker accounts={toList} value={toId} onChange={setToId} label={t('quick.to')} invalid={!!shown('to')} />
          </Field>
        </div>
      )}

      {kind === 'transfer' && differ && to && (
        <Field label={t('quick.counterAmount', { currency: to.currency })} hint={t('check.counterHint')} {...fieldProps('counter')}>
          <AmountInput
            className="w-56" value={counter} currency={to.currency} exponent={expOf(to.currency)} invalid={!!shown('counter')}
            placeholder={counterSuggest ? fmt(counterSuggest, to.currency) : ''} onChange={setCounter}
          />
        </Field>
      )}

      {kind === 'transfer' && (showFee || fee ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('quick.fee')} {...fieldProps('fee')}>
            <AmountInput value={fee} currency={from?.currency ?? base} exponent={expOf(from?.currency ?? base)} invalid={!!shown('fee')} onChange={setFee} />
          </Field>
          <Field label={t('quick.feeAccount')} {...fieldProps('feeAccount')}>
            <Picker accounts={expenses} value={feeAccount?.id ?? ''} onChange={setFeeAccountId} label={t('quick.feeAccount')} invalid={!!shown('feeAccount')} />
          </Field>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setShowFee(true)}>
          <PlusIcon data-icon="inline-start" />{t('quick.addFee')}
        </Button>
      ))}

      {kind === 'debt' && (
        <>
          <Field label={moneyIn(debtMode) ? t('quick.debt.receivedIn') : t('quick.debt.givenFrom')} {...fieldProps('money')}>
            <Picker
              accounts={moneyAccounts} value={moneyId} onChange={setMoneyId} invalid={!!shown('money')}
              label={moneyIn(debtMode) ? t('quick.debt.receivedIn') : t('quick.debt.givenFrom')}
            />
          </Field>
          {contactId && debtOpen.data !== undefined && (
            <p className="text-sm text-muted-foreground">
              {t(debtAccount?.subtype === 'payable' ? 'quick.debt.openPayable' : 'quick.debt.openReceivable')}
              {': '}
              <span className="tabular-nums">{fmt(debtOpen.data, base)} {base}</span>
            </p>
          )}
          {overpay && <p className="text-sm text-muted-foreground">{t('quick.debt.overpay', { amount: fmt(debtOpen.data ?? 0, base), currency: base })}</p>}
          {debtDiffer && debtAccount && (
            <Field label={t('quick.debt.debtAmount', { currency: debtAccount.currency })} hint={t('check.counterHint')} {...fieldProps('counter')}>
              <AmountInput
                className="w-56" value={counter} currency={debtAccount.currency} exponent={expOf(debtAccount.currency)} invalid={!!shown('counter')}
                placeholder={debtSuggest ? fmt(debtSuggest, debtAccount.currency) : ''} onChange={setCounter}
              />
            </Field>
          )}
        </>
      )}

      {kind !== 'transfer' && kind !== 'debt' && (single ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          {kind === 'expense' ? moneyField : (
            <Field label={splitLabel} {...fieldProps(`acc${first.key}`)}>
              <Picker accounts={categories} value={first.accountId} label={splitLabel} invalid={!!shown(`acc${first.key}`)} onChange={(id) => setSplit(first.key, { accountId: id })} />
            </Field>
          )}
          <ArrowRightIcon className="mt-7 size-4 text-muted-foreground" aria-hidden />
          {kind === 'expense' ? (
            <Field label={splitLabel} {...fieldProps(`acc${first.key}`)}>
              <Picker accounts={categories} value={first.accountId} label={splitLabel} invalid={!!shown(`acc${first.key}`)} onChange={(id) => setSplit(first.key, { accountId: id })} />
            </Field>
          ) : moneyField}
        </div>
      ) : (
        <>
          {moneyField}
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="[&>th]:px-1 [&>th]:pb-1 [&>th]:text-left [&>th]:font-medium">
                <th className="w-[40%]">{splitLabel}</th>
                <th>{t('ledger.memo')}</th>
                <th className="w-44 !text-right">{t('quick.amount')}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {splits.map((s, i) => {
                const a = acc(s.accountId)
                const accErr = shown(`acc${s.key}`)
                const amtErr = shown(`amt${s.key}`)
                return (
                  <tr key={s.key} className="align-top [&>td]:px-1 [&>td]:py-0.5">
                    <td>
                      <Picker
                        accounts={categories} value={s.accountId} label={`${splitLabel} ${i + 1}`} invalid={!!accErr}
                        onChange={(id) => setSplit(s.key, { accountId: id })}
                      />
                      <Msg error={accErr} warning={warns[`acc${s.key}`]} />
                    </td>
                    <td><Input maxLength={200} value={s.memo} onChange={(e) => setSplit(s.key, { memo: e.target.value })} /></td>
                    <td>
                      <AmountInput
                        value={s.amount} currency={a?.currency ?? base} exponent={expOf(a?.currency ?? base)} aria-label={t('quick.amount')}
                        invalid={!!amtErr} onChange={(v) => setSplit(s.key, { amount: v })}
                      />
                      <Msg error={amtErr} />
                    </td>
                    <td>
                      <Button
                        type="button" variant="ghost" size="icon-sm" aria-label={t('gj.removeLine')} tabIndex={-1}
                        onClick={() => setSplits((all) => all.filter((x) => x.key !== s.key))}
                      >
                        <Trash2Icon />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!mixed && money && <p className="text-end text-sm text-muted-foreground">{t('quick.total')}: <span className="font-medium text-foreground tabular-nums">{fmt(splitsTotal, money.currency)} {money.currency}</span></p>}
        </>
      ))}
      {kind !== 'transfer' && kind !== 'debt' && (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setSplits((all) => [...all, emptySplit()])}>
          <PlusIcon data-icon="inline-start" />{single ? t('quick.split') : t('quick.addAccount')}
        </Button>
      )}

      {mixed && money && (
        <Field
          label={kind === 'expense' ? t('quick.moneyOut', { currency: money.currency }) : t('quick.moneyIn', { currency: money.currency })}
          hint={t('check.counterHint')} {...fieldProps('moneyAmount')}
        >
          <AmountInput
            className="w-56" value={moneyAmount} currency={money.currency} exponent={expOf(money.currency)} invalid={!!shown('moneyAmount')}
            placeholder={moneySuggest !== null ? fmt(moneySuggest, money.currency) : ''} onChange={setMoneyAmount}
          />
        </Field>
      )}

      <div className="flex items-start gap-3">
        <Field label={t('ledger.date')} {...fieldProps('date')}>
          <Input type="date" className="w-40" value={date} max={today()} aria-invalid={!!shown('date') || undefined} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field
          label={t('ledger.description')} className="flex-1"
          hint={description.length >= 160 ? `${description.length}/200` : undefined}
        >
          <Input maxLength={200} value={description} placeholder={t(`quick.example.${kind}`)} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      {kind !== 'debt' && (showContact || contactId ? (
        <Field label={t('directory.field')} className="w-72">
          <ContactPicker
            contacts={activeContacts} value={contactId} onChange={changeContact} aria-label={t('directory.field')}
            className="rounded-3xl bg-input/50 px-1 text-foreground [&_input]:rounded-3xl"
          />
        </Field>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setShowContact(true)}>
          <UserPlusIcon data-icon="inline-start" />{t('quick.addContact')}
        </Button>
      ))}

      {lines && !errorCount && (
        <div className="flex flex-col gap-2">
          <Button type="button" variant="ghost" size="sm" className="w-fit" aria-expanded={showBooking} onClick={() => setShowBooking(!showBooking)}>
            <ChevronRightIcon data-icon="inline-start" className={showBooking ? 'rotate-90' : undefined} />
            {t('quick.showBooking')}
          </Button>
          {showBooking && <Preview lines={lines} byId={byId} base={base} fmt={(d, cur) => fmt(toMinor(d, expOf(cur)), cur)} />}
        </div>
      )}

      <div className="flex items-center gap-3 border-t pt-3">
        {save.error ? <FormError message={errorMessage(t, save.error)} />
          : attempted && errorCount > 0 ? <p className="text-sm text-destructive" role="alert">{t('check.missing', { count: errorCount })}</p> : null}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>{t('ledger.cancel')}</Button>
          <Button type="button" disabled={save.isPending} onClick={submit} title="Ctrl+Enter">
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t('ledger.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// One labelled field with its message under it: an error (red), else a warning (muted, with an icon), else a hint.
function Field({ label, className, children, error, warning, hint, onTouch }: {
  label: string; className?: string; children: ReactNode; error?: string; warning?: string; hint?: string; onTouch?: () => void
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`} onBlurCapture={onTouch}>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {label}
        {children}
      </label>
      <Msg error={error} warning={warning} hint={hint} />
    </div>
  )
}

function Msg({ error, warning, hint }: { error?: string; warning?: string; hint?: string }) {
  if (error) return <p className="flex items-start gap-1 text-xs text-destructive" role="alert"><CircleAlertIcon className="mt-0.5 size-3 shrink-0" />{error}</p>
  if (warning) return <p className="flex items-start gap-1 text-xs text-muted-foreground"><TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />{warning}</p>
  if (hint) return <p className="text-xs text-muted-foreground">{hint}</p>
  return null
}

function Picker({ accounts, value, onChange, label, invalid }: {
  accounts: AccountNode[]; value: string; onChange: (id: string) => void; label: string; invalid?: boolean
}) {
  return (
    <AccountPicker
      accounts={accounts} value={value} onChange={onChange} invalid={invalid} aria-label={label}
      className="rounded-3xl bg-input/50 px-1 text-foreground [&_input]:rounded-3xl"
    />
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
