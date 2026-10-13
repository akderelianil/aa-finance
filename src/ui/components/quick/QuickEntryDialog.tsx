import { useQueries } from '@tanstack/react-query'
import { ArrowLeftRightIcon, ArrowRightIcon, ChevronRightIcon, HandCoinsIcon, NotebookPenIcon, PlusIcon, Trash2Icon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntryInput } from '../../../core/api/entries.ts'
import { toBase } from '../../../core/money.ts'
import * as quick from '../../../core/quick.ts'
import { AccountPicker, NEW, type PickerItem } from '@/components/journal/AccountPicker'
import { AmountInput } from '@/components/journal/AmountInput'
import { OptionSelect } from '@/components/OptionSelect'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { amountIssue, currencySymbol, fromBase, parseDecimal, toDecimal, toMinor, today } from '@/lib/amount'
import { call, useErrorText, useOp } from '@/lib/api'
import { flattenTree, shown, useAccountTree, useBook, type AccountNode } from '@/lib/ledger'
import { useQueryClient } from '@tanstack/react-query'

export type QuickKind = 'expense' | 'income' | 'transfer' | 'debt'
const DEBT_KINDS: quick.DebtKind[] = ['lend', 'borrow', 'collect', 'repay']

/**
 * Hızlı Kayıt: one form with the kind as tabs (Gider first). Serbest kayıt hands over to the journal editor (`onFree`).
 */
export function QuickEntryDialog({ open, onClose, onFree }: { open: boolean; onClose: () => void; onFree: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('quick.title')}</DialogTitle>
          <DialogDescription>{t('quick.subtitle')}</DialogDescription>
        </DialogHeader>
        <QuickForm onClose={onClose} onFree={() => { onClose(); onFree() }} />
      </DialogContent>
    </Dialog>
  )
}

type Split = { key: number; account: string; money: string; amount: string }
let nextKey = 1
const emptySplit = (): Split => ({ key: nextKey++, account: '', money: '', amount: '' })

// Hızlı Kayıt: Gider · Gelir · Transfer · Borç ([docs/ux](../../../../docs/ux/README.md)). Each form builds one
// entries.post input with the core builders (src/core/quick.ts); the booking can be shown before saving.
function QuickForm({ onClose, onFree }: { onClose: () => void; onFree: () => void }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const qc = useQueryClient()
  const { base, minor, fmt } = useBook()
  const accounts = useOp('accounts.list', {})
  const usage = useOp('accounts.usage', {})
  const contacts = useOp('contacts.list', {})
  const balances = useOp('contacts.balances', {})
  const { roots, byId } = useAccountTree(accounts.data)
  const postable = useMemo(() => flattenTree(roots).filter((a) => !a.placeholder && !a.archived), [roots])
  const sys = (key: string) => postable.find((a) => a.systemKey === key) ?? flattenTree(roots).find((a) => a.systemKey === key)

  const [kind, setKind] = useState<QuickKind>('expense')
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  // Member the entry belongs to: the signed-in member until changed; '' = by account owner.
  const [picked, setMember] = useState<string | null>(null)
  const members = useOp('members.list', {}).data ?? []
  const me = useOp('settings.get', {}).data?.me.id
  const member = picked ?? (me ? String(me) : '')
  const [moneyRaw, setMoney] = useState('') // Gider/Gelir/Borç money account; '' = default (Gider/Gelir: the wallet)
  const [splits, setSplits] = useState<Split[]>([emptySplit()])
  const [total, setTotal] = useState('') // split mode: the receipt total; '' = the sum of the rows
  const [done, setDone] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('') // Transfer, Borç
  const [counter, setCounter] = useState('') // the other currency amount
  const [fee, setFee] = useState('')
  const [feeAccount, setFeeAccount] = useState('')
  const [showFee, setShowFee] = useState(false)
  const [debtKind, setDebtKind] = useState<quick.DebtKind>('lend')
  const [person, setPerson] = useState('')
  const [showBooking, setShowBooking] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<unknown>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const acc = (v: string) => (v && !v.startsWith(NEW) ? byId.get(Number(v)) : undefined)
  const assets = postable.filter((a) => a.type === 'asset' && a.systemKey !== 'receivables' && a.parent !== sys('receivables')?.id)
  const cards = postable.filter((a) => a.type === 'liability' && a.parent !== sys('payables')?.id && a.systemKey !== 'payables')
  const receivable = debtKind === 'lend' || debtKind === 'collect'
  const debtGroup = sys(receivable ? 'receivables' : 'payables')
  // Rehber records as picker items; the path column shows the kind.
  const people = useMemo<PickerItem[]>(
    () => (contacts.data ?? []).map((c) => ({ id: c.id, label: c.name, path: t(`dir.kind.${c.kind}`), currency: '' })),
    [contacts.data, t],
  )
  const contactById = new Map((contacts.data ?? []).map((c) => [c.id, c]))
  const personName = person.startsWith(NEW) ? person.slice(NEW.length) : contactById.get(Number(person))?.name ?? ''
  // The debt account of the money currency: the group itself, or its sub-account named by the currency code.
  const debtAccounts = debtGroup ? [debtGroup, ...postable.filter((a) => a.parent === debtGroup.id && a.label === a.currency)] : []
  const feeAcc = acc(feeAccount) ?? sys('bank_fee')
  // Default account: the wallet of the member the entry is for, else the first wallet.
  const wallets = postable.filter((a) => a.parent === sys('cash')?.id && a.type === 'asset')
  const wallet = wallets.find((a) => member && a.owner === Number(member)) ?? wallets[0]
  const money = moneyRaw || (kind === 'expense' || kind === 'income' ? String(wallet?.id ?? '') : '')

  // Stored day rates of the foreign currencies on the form.
  const curOf = (v: string) => acc(v)?.currency
  const debtCur = curOf(money) ?? debtGroup?.currency
  const used = kind === 'transfer' ? [curOf(from), curOf(to), feeAcc?.currency]
    : kind === 'debt' ? [curOf(money)]
    : [curOf(money), ...splits.map((s) => curOf(s.money))]
  const foreign = [...new Set(used.filter((c): c is string => !!c && c !== base))]
  const rates = useQueries({
    queries: foreign.map((currency) => ({
      queryKey: ['fx.get', { currency, date }],
      queryFn: () => call('fx.get', { currency, date }),
      enabled: !!date,
    })),
  })
  const rateOf = (c?: string) => (c === base ? '1' : c ? rates[foreign.indexOf(c)]?.data?.rate : undefined)
  // Amount in one currency → another, through base at the stored rates. Only a suggestion.
  const convert = (n: number, fromCur: string, toCur: string) => {
    const rf = rateOf(fromCur)
    const rt = rateOf(toCur)
    if (!rf || !rt) return null
    const b = fromCur === base ? n : toBase(n, rf, minor(fromCur), minor(base))
    return toCur === base ? b : fromBase(b, rt, minor(base), minor(toCur))
  }

  const parse = (raw: string, cur: string) => {
    const d = parseDecimal(raw, minor(cur))
    return d ? toMinor(d, minor(cur)) : 0
  }
  const book: quick.Book = { base, minor }
  const qa = (a: AccountNode): quick.QuickAccount => ({ id: a.id, type: a.type, currency: a.currency })

  // Field checks. Every blocking problem has a message; the builder checks the rest.
  const errs: Record<string, string> = {}
  const need = (key: string, v: string) => { if (!v) errs[key] = t('check.account') }
  const amt = (key: string, raw: string, cur: string, required = true) => {
    if (!raw.trim()) { if (required) errs[key] = t('check.amount_required'); return }
    const i = amountIssue(raw, minor(cur))
    if (i) errs[key] = t(`check.amount_${i}`, { count: minor(cur) })
  }
  if (!date) errs.date = t('check.dateRequired')

  let input: EntryInput | null = null
  let buildError: string | null = null
  let counterHint: { cur: string; suggest: number | null } | null = null
  let openBalance: { value: number; cur: string } | null = null
  let warn: string | null = null
  const head = { date, description: description.trim() || null }

  try {
    if (kind === 'expense' || kind === 'income') {
      need('money', money)
      const m = acc(money)
      const rows = splits.filter((s, i) => i === 0 || s.account || s.amount)
      const rowMoney = (s: Split) => acc(s.money || money)
      const splitSum = rows.reduce((x, s) => x + parse(s.amount, rowMoney(s)?.currency ?? base), 0)
      rows.forEach((s) => {
        need(`acc${s.key}`, s.account)
        amt(`amt${s.key}`, s.amount, rowMoney(s)?.currency ?? base)
      })
      if (splits.length > 1 && total.trim()) {
        amt('total', total, m?.currency ?? base)
        if (!errs.total && parse(total, m?.currency ?? base) !== splitSum) errs.total = t('quick.splitMismatch')
      }
      if (m && !Object.keys(errs).length) {
        // Amounts are in the row's money account currency; a split in base converts at the money currency rate.
        const parsed = rows.map((s) => ({
          account: acc(s.account) ? qa(acc(s.account)!) : { id: -s.key, type: kind, currency: rowMoney(s)!.currency },
          amount: parse(s.amount, rowMoney(s)!.currency),
          money: s.money && s.money !== money ? qa(rowMoney(s)!) : undefined,
        }))
        const sum = parsed.reduce((x, s) => x + s.amount, 0)
        const f = { ...head, total: sum, splits: parsed, rate: rateOf(m.currency) }
        input = kind === 'expense' ? quick.expense(book, { ...f, from: qa(m) }) : quick.income(book, { ...f, to: qa(m) })
        const own = parsed.filter((s) => !s.money).reduce((x, s) => x + s.amount, 0)
        if (kind === 'expense' && m.type === 'asset' && own > m.balance) warn = t('check.lowBalance', { balance: fmt(m.balance, m.currency), currency: m.currency })
      }
    } else if (kind === 'transfer') {
      need('from', from)
      need('to', to)
      const f = acc(from)
      const tt = acc(to)
      amt('amount', amount, f?.currency ?? base)
      const feeMinor = f && fee.trim() ? parse(fee, f.currency) : 0
      if (fee.trim()) amt('fee', fee, f?.currency ?? base)
      if (f && tt && f.currency !== tt.currency) {
        const suggest = convert(parse(amount, f.currency), f.currency, tt.currency)
        counterHint = { cur: tt.currency, suggest }
        if (counter.trim()) amt('counter', counter, tt.currency)
        else if (suggest === null) errs.counter = t('check.counter')
      }
      if (f && tt && !Object.keys(errs).length) {
        const toAmount = counterHint ? (counter.trim() ? parse(counter, tt.currency) : counterHint.suggest!) : undefined
        input = quick.transfer(book, {
          ...head, from: qa(f), to: qa(tt), amount: parse(amount, f.currency), toAmount,
          fee: feeMinor || undefined, feeAccount: feeMinor && feeAcc ? qa(feeAcc) : undefined, rate: rateOf(f.currency),
        })
        if (f.balance < parse(amount, f.currency) + feeMinor) warn = t('check.lowBalance', { balance: fmt(f.balance, f.currency), currency: f.currency })
      }
    } else {
      need('person', person)
      need('money', money)
      const m = acc(money)
      amt('amount', amount, m?.currency ?? base)
      const p = person && !person.startsWith(NEW) ? contactById.get(Number(person)) : undefined
      // Open balance of this contact in the money currency (the debt is booked in that currency).
      if (p && m) openBalance = { value: (balances.data ?? []).find((b) => b.contact === p.id && b.currency === m.currency && b.kind === (receivable ? 'receivable' : 'payable'))?.amount ?? 0, cur: m.currency }
      if (m && debtGroup && person && !Object.keys(errs).length) {
        // A missing debt account and a new contact are booked on the placeholder id 0; save() creates them first.
        const found = debtAccounts.find((a) => a.currency === m.currency)
        const debt: quick.QuickAccount = found ? qa(found) : { id: 0, type: debtGroup.type, currency: m.currency }
        input = quick.debt(book, { ...head, kind: debtKind, money: qa(m), debt, amount: parse(amount, m.currency), rate: rateOf(m.currency), contact: p?.id ?? 0 })
        const reduces = debtKind === 'collect' || debtKind === 'repay'
        if (reduces && openBalance && parse(amount, m.currency) > openBalance.value) warn = t('quick.overpay', { amount: fmt(openBalance.value, openBalance.cur), currency: openBalance.cur })
      }
    }
  } catch (e) {
    if (e instanceof quick.QuickError) buildError = t(`errors.${e.code}` as 'errors.internal')
    else throw e
  }

  const errorCount = Object.keys(errs).length
  const show = (key: string) => (attempted ? errs[key] : undefined)

  async function save(again = false) {
    if (saving) return
    setDone(null)
    if (errorCount || buildError || !input) {
      setAttempted(true)
      setTimeout(() => rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 50)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      let entry = input
      if (kind === 'debt' && debtGroup) {
        // A new name joins the Rehber as a Person; a currency with no debt account gets one under the group.
        const cur = acc(money)!.currency
        const contact = person.startsWith(NEW) ? (await call('contacts.create', { kind: 'individual', name: personName })).id : Number(person)
        const account = debtAccounts.find((a) => a.currency === cur)?.id
          ?? (await call('accounts.create', { parent: debtGroup.id, name: cur, currency: cur })).id
        entry = {
          ...entry,
          lines: entry.lines.map((l) => ({ ...l, account: l.account === 0 ? account : l.account, ...(l.contact === 0 && { contact }) })),
        }
      }
      if (kind === 'expense' || kind === 'income') {
        // New accounts typed into the category field are opened first (once per name), under the Gider/Gelir root.
        const root = sys(kind)
        const made = new Map<string, number>()
        const ids = new Map<number, number>()
        for (const s of splits) {
          if (!s.account.startsWith(NEW) || !root) continue
          const name = s.account.slice(NEW.length)
          if (!made.has(name)) made.set(name, (await call('accounts.create', { parent: root.id, name, currency: curOf(s.money) ?? moneyCur })).id)
          ids.set(-s.key, made.get(name)!)
        }
        entry = { ...entry, lines: entry.lines.map((l) => (ids.has(l.account) ? { ...l, account: ids.get(l.account)! } : l)) }
      }
      // A line on another member's own account stays with that member.
      if (member) {
        const ownerOf = (id: number) => accounts.data?.find((a) => a.id === id)?.owner ?? null
        entry = { ...entry, lines: entry.lines.map((l) => ([null, Number(member)].includes(ownerOf(l.account)) ? { ...l, member: Number(member) } : l)) }
      }
      await call('entries.post', entry)
      await qc.invalidateQueries()
      if (again) {
        // Keep kind, date and the account; clear what changes from receipt to receipt.
        setSplits([emptySplit()])
        setTotal('')
        setAmount('')
        setCounter('')
        setFee('')
        setDescription('')
        setAttempted(false)
        setDone(t('quick.saved'))
        setTimeout(() => rootRef.current?.querySelector<HTMLElement>('input[inputmode="decimal"]')?.focus(), 50)
      } else onClose()
    } catch (e) {
      setSaveError(e)
      // An account opened before a failed post stays (the user made it); refresh so the form picks it up.
      await qc.invalidateQueries()
    } finally {
      setSaving(false)
    }
  }

  function changeKind(k: QuickKind) {
    setKind(k)
    setMoney('')
    setSplits([emptySplit()])
    setTotal('')
    setAmount('')
    setCounter('')
    setAttempted(false)
    setDone(null)
  }
  const setSplit = (key: number, patch: Partial<Split>) => setSplits((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)))
  const moneyCur = curOf(money) ?? base
  const rowCur = (s: Split) => curOf(s.money || money) ?? base
  const splitTotal = splits.reduce((x, r) => x + parse(r.amount, rowCur(r)), 0)
  const totalMinor = total.trim() ? parse(total, moneyCur) : 0
  const left = totalMinor ? totalMinor - splitTotal : 0

  // The split starts from the single amount; a new row takes what is left of the total.
  const startSplit = () => {
    setTotal(splits[0].amount)
    setSplits((all) => [...all, emptySplit()])
  }
  const addRow = () => setSplits((all) => [...all, { ...emptySplit(), amount: left > 0 ? toDecimal(left, minor(moneyCur)) : '' }])
  // Removing a row down to one: its own account becomes the top Hesap, the total its amount.
  const removeSplit = (key: number) => {
    const rest = splits.filter((x) => x.key !== key)
    if (rest.length === 1) {
      if (rest[0].money) setMoney(rest[0].money)
      rest[0] = { ...rest[0], money: '', amount: total.trim() || rest[0].amount }
      setTotal('')
    }
    setSplits(rest)
  }

  const heroCur = kind === 'transfer' ? curOf(from) ?? base : moneyCur
  const single = (kind === 'expense' || kind === 'income') && splits.length === 1
  const heroKey = kind === 'transfer' || kind === 'debt' ? 'amount' : single ? `amt${splits[0].key}` : 'total'
  const heroValue = kind === 'transfer' || kind === 'debt' ? amount : single ? splits[0].amount : total
  const heroSet = (v: string) => (kind === 'transfer' || kind === 'debt' ? setAmount(v) : single ? setSplit(splits[0].key, { amount: v }) : setTotal(v))
  const heroAccount = acc(kind === 'transfer' ? from : money)
  const categoryLabel = kind === 'expense' ? t('quick.expenseAccount') : t('quick.incomeAccount')
  const moneyLabel = kind === 'expense' ? t('quick.paidFrom') : kind === 'income' ? t('quick.paidTo')
    : debtKind === 'borrow' || debtKind === 'collect' ? t('quick.receivedIn') : t('quick.givenFrom')
  const categories = postable.filter((a) => a.type === kind)
  const moneyList = kind === 'expense' ? [...assets, ...cards] : assets

  // The most used accounts of the last months, as one-click shortcuts under a field.
  const rank = new Map((usage.data ?? []).map((id, i) => [id, i]))
  const top = (list: AccountNode[]) => list.filter((a) => rank.has(a.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!).slice(0, 4)
  const picker = (key: string, list: AccountNode[], value: string, onChange: (v: string) => void, label: string, creatable = false) => (
    <AccountPicker accounts={list} value={value} onChange={onChange} invalid={!!show(key)} aria-label={label} creatable={creatable} className="rounded-md border border-input" />
  )
  const chips = (list: AccountNode[], value: string, onChange: (v: string) => void) => {
    const items = top(list)
    return items.length ? (
      <div className="flex flex-wrap gap-1">
        {items.map((a) => (
          <Button key={a.id} type="button" size="xs" tabIndex={-1} variant={String(a.id) === value ? 'secondary' : 'outline'} onClick={() => onChange(String(a.id))}>
            {a.label}
          </Button>
        ))}
      </div>
    ) : null
  }
  // A labelled account field: picker plus shortcuts.
  const account = (key: string, label: string, list: AccountNode[], value: string, onChange: (v: string) => void, creatable = false) => (
    <Field label={label} error={show(key)} below={chips(list, value, onChange)}
      hint={value.startsWith(NEW) ? t('quick.newAccountHint', { group: sys(kind)?.label ?? '' }) : undefined}>
      {picker(key, list, value, onChange, label, creatable)}
    </Field>
  )

  // The debt line shows the group and the contact: "Kişilerden Alacaklar (Ayşe)".
  const debtLine = (id: number) => kind === 'debt' && debtAccounts.some((a) => a.id === id) || id === 0
  const bookLabel = (id: number) => debtLine(id) ? `${debtGroup?.label ?? ''} (${personName})`
    : acc(String(id))?.label ?? splits.find((x) => -x.key === id)?.account.slice(NEW.length) ?? ''
  const bookCurrency = (id: number) => acc(String(id))?.currency ?? (id < 0 ? moneyCur : debtCur ?? base)

  if (accounts.isError) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription className="flex items-center justify-between gap-3">
          {errorText(accounts.error)}
          <Button type="button" variant="outline" size="sm" onClick={() => void accounts.refetch()}>{t('state.retry')}</Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (!accounts.data) return <div className="flex flex-col gap-3"><Skeleton className="h-9 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-9 w-full" /></div>

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-4"
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(e.shiftKey) } }}
    >
      <Tabs value={kind} onValueChange={(v) => changeKind(v as QuickKind)}>
        <TabsList>
          <TabsTrigger value="expense"><TrendingDownIcon className="text-chart-4" />{t('quick.kind.expense')}</TabsTrigger>
          <TabsTrigger value="income"><TrendingUpIcon className="text-chart-2" />{t('quick.kind.income')}</TabsTrigger>
          <TabsTrigger value="transfer"><ArrowLeftRightIcon className="text-primary" />{t('quick.kind.transfer')}</TabsTrigger>
          <TabsTrigger value="debt"><HandCoinsIcon className="text-primary" />{t('quick.kind.debt')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {kind === 'debt' && (
        <ToggleGroup
          value={[debtKind]} spacing={2} className="grid w-full grid-cols-4" aria-label={t('quick.kind.debt')}
          onValueChange={(v) => { if (v[0]) setDebtKind(v[0] as quick.DebtKind) }}
        >
          {DEBT_KINDS.map((m) => <ToggleGroupItem key={m} value={m} variant="outline" size="sm">{t(`quick.debtKind.${m}`)}</ToggleGroupItem>)}
        </ToggleGroup>
      )}

      <Field
        label={t('quick.amount')} error={show(heroKey)}
        hint={heroAccount ? t('quick.balanceOf', { account: heroAccount.label, amount: `${fmt(shown(heroAccount.type, heroAccount.balance), heroAccount.currency)} ${currencySymbol(heroAccount.currency)}` }) : undefined}
      >
        <AmountInput
          autoFocus className="h-12 text-2xl font-semibold md:text-2xl" currency={currencySymbol(heroCur)} exponent={minor(heroCur)} placeholder="0,00"
          value={heroValue} invalid={!!show(heroKey)} onChange={heroSet}
        />
      </Field>

      {kind === 'debt' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('quick.person')} error={show('person')}
            hint={person.startsWith(NEW) ? t('quick.newPersonHint') : undefined}>
            <AccountPicker
              accounts={people} value={person} onChange={setPerson} invalid={!!show('person')} aria-label={t('quick.person')}
              creatable placeholder={t('quick.personPlaceholder')} className="rounded-md border border-input"
            />
          </Field>
          {account('money', moneyLabel, assets, money, setMoney)}
        </div>
      )}
      {openBalance && (
        <p className="text-sm text-muted-foreground">
          {t(receivable ? 'quick.openReceivable' : 'quick.openPayable')}: <span className="text-foreground tabular-nums">{fmt(openBalance.value, openBalance.cur)} {openBalance.cur}</span>
        </p>
      )}

      {kind === 'transfer' && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          {account('from', t('quick.from'), assets, from, setFrom)}
          <ArrowRightIcon className="mt-7 size-4 text-muted-foreground" aria-hidden />
          {account('to', t('quick.to'), [...assets, ...cards], to, setTo)}
        </div>
      )}

      {counterHint && (
        <Field className="w-64" label={t('quick.counterAmount', { currency: counterHint.cur })} hint={t('quick.counterHint')} error={show('counter')}>
          <AmountInput
            value={counter} currency={counterHint.cur} exponent={minor(counterHint.cur)} invalid={!!show('counter')}
            placeholder={counterHint.suggest !== null ? fmt(counterHint.suggest, counterHint.cur) : ''} onChange={setCounter}
          />
        </Field>
      )}

      {kind === 'transfer' && (showFee || fee ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('quick.fee')} error={show('fee')}>
            <AmountInput value={fee} currency={curOf(from) ?? base} exponent={minor(curOf(from) ?? base)} invalid={!!show('fee')} onChange={setFee} />
          </Field>
          <Field label={t('quick.feeAccount')}>
            {picker('feeAccount', postable.filter((a) => a.type === 'expense'), feeAcc ? String(feeAcc.id) : '', setFeeAccount, t('quick.feeAccount'))}
          </Field>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setShowFee(true)}>
          <PlusIcon data-icon="inline-start" />{t('quick.addFee')}
        </Button>
      ))}

      {(kind === 'expense' || kind === 'income') && (single ? (
        <div className="grid grid-cols-2 gap-3">
          {account('money', t('quick.account'), moneyList, money, setMoney)}
          {account(`acc${splits[0].key}`, categoryLabel, categories, splits[0].account, (v) => setSplit(splits[0].key, { account: v }), true)}
        </div>
      ) : (
        account('money', t('quick.account'), moneyList, money, setMoney)
      ))}

      <div className="flex items-start gap-3">
        <Field label={t('gj.date')} error={show('date')}>
          <Input type="date" className="w-40" value={date} aria-invalid={!!show('date') || undefined} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('gj.description')} className="flex-1">
          <Input maxLength={1000} value={description} placeholder={t(`quick.example.${kind}`)} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label={t('scope.forWhom')}>
          <OptionSelect
            className="w-36" value={member} onChange={setMember}
            options={[{ value: '', label: t('scope.byAccount') }, ...members.map((m) => ({ value: String(m.id), label: m.name }))]}
          />
        </Field>
      </div>

      {(kind === 'expense' || kind === 'income') && (single ? (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={startSplit}>
          <PlusIcon data-icon="inline-start" />{t('quick.split')}
        </Button>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-popover text-xs text-muted-foreground">
                <tr className="[&>th]:px-1 [&>th]:pb-1 [&>th]:text-left [&>th]:font-medium">
                  <th className="w-[30%]">{t('quick.account')}</th>
                  <th className="w-[30%]">{categoryLabel}</th>
                  <th className="!text-right">{t('quick.amount')}</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {splits.map((s, i) => (
                  <tr key={s.key} className="align-top [&>td]:px-1 [&>td]:py-0.5">
                    <td>{picker(`mon${s.key}`, moneyList, s.money || money, (v) => setSplit(s.key, { money: v === money ? '' : v }), `${t('quick.account')} ${i + 1}`)}</td>
                    <td>{picker(`acc${s.key}`, categories, s.account, (v) => setSplit(s.key, { account: v }), `${categoryLabel} ${i + 1}`, true)}</td>
                    <td>
                      <AmountInput
                        value={s.amount} currency={currencySymbol(rowCur(s))} exponent={minor(rowCur(s))} aria-label={t('quick.amount')}
                        invalid={!!show(`amt${s.key}`)} onChange={(v) => setSplit(s.key, { amount: v })}
                      />
                    </td>
                    <td>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={t('gj.removeLine')} tabIndex={-1} onClick={() => removeSplit(s.key)}>
                        <Trash2Icon />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-1">
            <Button type="button" variant="ghost" size="sm" onClick={addRow}>
              <PlusIcon data-icon="inline-start" />{t('quick.addAccount')}
            </Button>
            <span className={`text-sm tabular-nums ${left < 0 ? 'text-destructive' : 'text-muted-foreground'}`} aria-live="polite">
              {left > 0 ? `${t('quick.remaining')}: ${fmt(left, moneyCur)} ${currencySymbol(moneyCur)}`
                : left < 0 ? `${t('quick.over')}: ${fmt(-left, moneyCur)} ${currencySymbol(moneyCur)}`
                : `${t('quick.total')}: ${fmt(splitTotal, moneyCur)} ${currencySymbol(moneyCur)}`}
            </span>
          </div>
        </div>
      ))}

      {warn && <p className="text-sm text-muted-foreground">{warn}</p>}

      {input && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className="shrink-0" aria-expanded={showBooking} onClick={() => setShowBooking(!showBooking)}>
              <ChevronRightIcon data-icon="inline-start" className={showBooking ? 'rotate-90' : undefined} />
              {t('quick.showBooking')}
            </Button>
            {!showBooking && <p className="min-w-0 truncate text-xs text-muted-foreground tabular-nums">{bookingSummary(input, bookLabel, bookCurrency, fmt)}</p>}
          </div>
          {showBooking && <Booking input={input} label={bookLabel} currency={bookCurrency} base={base} fmt={fmt} />}
        </div>
      )}

      <div className="flex items-center gap-3 border-t pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={onFree} title={t('quick.chooser.freeHint')}>
          <NotebookPenIcon data-icon="inline-start" />{t('quick.chooser.free')}
        </Button>
        {saveError ? (
          <Alert variant="destructive" role="alert" className="flex-1"><AlertDescription>{errorText(saveError)}</AlertDescription></Alert>
        ) : attempted && (errorCount || buildError) ? (
          <p className="text-sm text-destructive" role="alert">{errorCount ? t('check.missing', { count: errorCount }) : buildError}</p>
        ) : done ? (
          <p className="text-sm text-muted-foreground" role="status">{done}</p>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => void save(true)} title="Ctrl+Shift+Enter">{t('quick.saveAndNew')}</Button>
          <Button type="button" disabled={saving} onClick={() => void save()} title="Ctrl+Enter">
            {saving && <Spinner data-icon="inline-start" />}
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, className, children, error, hint, below }: { label: string; className?: string; children: ReactNode; error?: string; hint?: string; below?: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`}>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {label}
        {children}
      </label>
      {below}
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

// "Cüzdan −500,00 → Market +500,00": where the money leaves and where it lands.
function bookingSummary(input: EntryInput, label: (id: number) => string, currency: (id: number) => string, fmt: (n: number, c?: string) => string) {
  const side = (debit: boolean) => input.lines
    .filter((l) => (l.amount > 0) === debit)
    .map((l) => `${label(l.account)} ${debit ? '+' : '−'}${fmt(Math.abs(l.amount), currency(l.account))}`)
    .join(', ')
  return `${side(false)} → ${side(true)}`
}

// The entry the form will post: account, Borç, Alacak in the account currency.
function Booking({ input, label, currency, base, fmt }: {
  input: EntryInput; label: (id: number) => string; currency: (id: number) => string; base: string; fmt: (n: number, c?: string) => string
}) {
  const { t } = useTranslation()
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted-foreground">
        <tr className="[&>th]:px-1 [&>th]:text-left [&>th]:font-medium">
          <th>{t('gj.account')}</th>
          <th className="w-36 !text-right">{t('ledger.debit')}</th>
          <th className="w-36 !text-right">{t('ledger.credit')}</th>
        </tr>
      </thead>
      <tbody className="bg-muted/30">
        {input.lines.map((l, i) => {
          const cur = currency(l.account)
          const cell = (debit: boolean) => ((l.amount > 0) === debit
            ? <>{fmt(Math.abs(l.amount), cur)}{cur !== base && <span className="ms-1 text-xs text-muted-foreground">{cur}</span>}</>
            : '')
          return (
            <tr key={i} className="[&>td]:px-1 [&>td]:py-1">
              <td className={l.amount < 0 ? 'ps-8' : ''}>
                {label(l.account)}
                {l.memo && <span className="ms-2 text-xs text-muted-foreground">{l.memo}</span>}
              </td>
              <td className="text-right tabular-nums">{cell(true)}</td>
              <td className="text-right tabular-nums">{cell(false)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
