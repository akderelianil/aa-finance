import { useQueries } from '@tanstack/react-query'
import { ArrowLeftIcon, ArrowLeftRightIcon, ArrowRightIcon, ChevronRightIcon, HandCoinsIcon, PlusIcon, Trash2Icon, NotebookPenIcon, TrendingDownIcon, TrendingUpIcon, type LucideIcon } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntryInput } from '../../../core/api/entries.ts'
import { toBase } from '../../../core/money.ts'
import * as quick from '../../../core/quick.ts'
import { AccountPicker, NEW } from '@/components/journal/AccountPicker'
import { AmountInput } from '@/components/journal/AmountInput'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { amountIssue, fromBase, parseDecimal, toMinor, today } from '@/lib/amount'
import { call, useErrorText, useOp } from '@/lib/api'
import { flattenTree, shown, useAccountTree, useBook, type AccountNode } from '@/lib/ledger'
import { useQueryClient } from '@tanstack/react-query'

export type QuickKind = 'expense' | 'income' | 'transfer' | 'debt'
const DEBT_KINDS: quick.DebtKind[] = ['lend', 'borrow', 'collect', 'repay']

const CHOICES: { key: QuickKind; icon: LucideIcon; tone: string }[] = [
  { key: 'expense', icon: TrendingDownIcon, tone: 'text-chart-4' },
  { key: 'income', icon: TrendingUpIcon, tone: 'text-chart-2' },
  { key: 'transfer', icon: ArrowLeftRightIcon, tone: 'text-primary' },
  { key: 'debt', icon: HandCoinsIcon, tone: 'text-primary' },
]

/**
 * Hızlı Kayıt in two steps: first say what happened in everyday words, then fill that form.
 * "Back" returns to the choice; Serbest kayıt hands over to the journal editor (`onFree`).
 */
export function QuickEntryDialog({ open, onClose, onFree }: { open: boolean; onClose: () => void; onFree: () => void }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<QuickKind | null>(null)
  const close = () => { onClose(); setKind(null) }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className={kind ? 'sm:max-w-2xl' : 'sm:max-w-xl'}>
        <DialogHeader>
          <DialogTitle>{kind ? t('quick.title') : t('quick.chooser.title')}</DialogTitle>
          <DialogDescription>{kind ? t('quick.subtitle') : t('quick.chooser.subtitle')}</DialogDescription>
        </DialogHeader>
        {kind
          ? <QuickForm key={kind} initial={kind} onClose={close} onBack={() => setKind(null)} />
          : <Chooser onChoose={setKind} onFree={() => { close(); onFree() }} />}
      </DialogContent>
    </Dialog>
  )
}

function Chooser({ onChoose, onFree }: { onChoose: (k: QuickKind) => void; onFree: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {CHOICES.map(({ key, icon: Icon, tone }, i) => (
          <Button
            key={key} type="button" variant="outline" size="lg" autoFocus={i === 0}
            className="h-auto flex-col items-start gap-2 py-4 text-start whitespace-normal"
            onClick={() => onChoose(key)}
          >
            <Icon className={`size-6 ${tone}`} aria-hidden />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{t(`quick.kind.${key}`)}</span>
              <span className="text-xs font-normal text-muted-foreground">{t(`quick.chooser.${key}`)}</span>
            </span>
          </Button>
        ))}
      </div>
      <Button type="button" variant="ghost" className="h-auto justify-start gap-3 py-2 whitespace-normal" onClick={onFree}>
        <NotebookPenIcon className="size-5 text-muted-foreground" aria-hidden />
        <span className="flex flex-col items-start gap-0.5 text-start">
          <span className="text-sm font-medium">{t('quick.chooser.free')}</span>
          <span className="text-xs font-normal text-muted-foreground">{t('quick.chooser.freeHint')}</span>
        </span>
      </Button>
    </div>
  )
}

// `money` '' = the row follows the top Hesap; a value overrides it for this row.
type Split = { key: number; account: string; money: string; amount: string }
let nextKey = 1
const emptySplit = (): Split => ({ key: nextKey++, account: '', money: '', amount: '' })

// Hızlı Kayıt: Gider · Gelir · Transfer · Borç ([docs/ux](../../../../docs/ux/README.md)). Each form builds one
// entries.post input with the core builders (src/core/quick.ts); the booking can be shown before saving.
function QuickForm({ initial, onClose, onBack }: { initial: QuickKind; onClose: () => void; onBack: () => void }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const qc = useQueryClient()
  const { base, minor, fmt } = useBook()
  const accounts = useOp('accounts.list', {})
  const { roots, byId } = useAccountTree(accounts.data)
  const postable = useMemo(() => flattenTree(roots).filter((a) => !a.placeholder && !a.archived), [roots])
  const sys = (key: string) => postable.find((a) => a.systemKey === key) ?? flattenTree(roots).find((a) => a.systemKey === key)

  const [kind, setKind] = useState<QuickKind>(initial)
  const [date, setDate] = useState(today())
  const [description, setDescription] = useState('')
  const [moneyRaw, setMoney] = useState('') // Gider/Gelir/Borç money account; '' = default (Gider/Gelir: the wallet)
  const [splits, setSplits] = useState<Split[]>([emptySplit()])
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
  const people = postable.filter((a) => a.parent === debtGroup?.id)
  const feeAcc = acc(feeAccount) ?? sys('bank_fee')
  const wallet = postable.find((a) => a.parent === sys('cash')?.id && a.type === 'asset')
  const money = moneyRaw || (kind === 'expense' || kind === 'income' ? String(wallet?.id ?? '') : '')

  // Stored day rates of the foreign currencies on the form.
  const curOf = (v: string) => acc(v)?.currency
  const debtCur = acc(person)?.currency ?? debtGroup?.currency
  const used = kind === 'transfer' ? [curOf(from), curOf(to), feeAcc?.currency]
    : kind === 'debt' ? [curOf(money), debtCur]
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
      rows.forEach((s) => {
        need(`acc${s.key}`, s.account)
        amt(`amt${s.key}`, s.amount, rowMoney(s)?.currency ?? base)
      })
      if (m && !Object.keys(errs).length) {
        // Amounts are in the row's money account currency; a split in base converts at the money currency rate.
        const parsed = rows.map((s) => ({
          account: qa(acc(s.account)!), amount: parse(s.amount, rowMoney(s)!.currency),
          money: s.money && s.money !== money ? qa(rowMoney(s)!) : undefined,
        }))
        const total = parsed.reduce((x, s) => x + s.amount, 0)
        const f = { ...head, total, splits: parsed, rate: rateOf(m.currency) }
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
      const p = acc(person)
      const pCur = p?.currency ?? debtGroup?.currency ?? base
      if (p) openBalance = { value: shown(p.type, p.balance), cur: p.currency }
      if (m && m.currency !== pCur) {
        const suggest = convert(parse(amount, m.currency), m.currency, pCur)
        counterHint = { cur: pCur, suggest }
        if (counter.trim()) amt('counter', counter, pCur)
        else if (suggest === null) errs.counter = t('check.counter')
      }
      if (m && debtGroup && person && !Object.keys(errs).length) {
        // A new person is booked on the placeholder id 0; save() opens the account first.
        const debt: quick.QuickAccount = p ? qa(p) : { id: 0, type: debtGroup.type, currency: pCur }
        const debtAmount = counterHint ? (counter.trim() ? parse(counter, pCur) : counterHint.suggest!) : undefined
        const creditCur = debtKind === 'lend' || debtKind === 'repay' ? m.currency : pCur
        input = quick.debt(book, { ...head, kind: debtKind, money: qa(m), debt, amount: parse(amount, m.currency), debtAmount, rate: rateOf(creditCur) })
        const reduces = debtKind === 'collect' || debtKind === 'repay'
        const debtMinor = debtAmount ?? parse(amount, m.currency)
        if (reduces && openBalance && debtMinor > openBalance.value) warn = t('quick.overpay', { amount: fmt(openBalance.value, openBalance.cur), currency: openBalance.cur })
      }
    }
  } catch (e) {
    if (e instanceof quick.QuickError) buildError = t(`errors.${e.code}` as 'errors.internal')
    else throw e
  }

  const errorCount = Object.keys(errs).length
  const show = (key: string) => (attempted ? errs[key] : undefined)

  async function save() {
    if (saving) return
    if (errorCount || buildError || !input) {
      setAttempted(true)
      setTimeout(() => rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 50)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      let entry = input
      if (kind === 'debt' && person.startsWith(NEW) && debtGroup) {
        const { id } = await call('accounts.create', { parent: debtGroup.id, name: person.slice(NEW.length) })
        entry = { ...entry, lines: entry.lines.map((l) => (l.account === 0 ? { ...l, account: id } : l)) }
      }
      await call('entries.post', entry)
      await qc.invalidateQueries()
      onClose()
    } catch (e) {
      setSaveError(e)
      // A person account opened before a failed post stays (the user made it); refresh so the form picks it up.
      await qc.invalidateQueries()
    } finally {
      setSaving(false)
    }
  }

  function changeKind(k: QuickKind) {
    setKind(k)
    setMoney('')
    setSplits([emptySplit()])
    setAmount('')
    setCounter('')
    setAttempted(false)
  }
  // Removing a row down to one: its own account becomes the top Hesap.
  const removeSplit = (key: number) => {
    const rest = splits.filter((x) => x.key !== key)
    if (rest.length === 1 && rest[0].money) { setMoney(rest[0].money); rest[0] = { ...rest[0], money: '' } }
    setSplits(rest)
  }
  const splitTotal = splits.reduce((x, r) => x + parse(r.amount, curOf(r.money || money) ?? base), 0)
  const setSplit = (key: number, patch: Partial<Split>) => setSplits((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)))

  const moneyCur = curOf(money) ?? base
  const heroCur = kind === 'transfer' ? curOf(from) ?? base : moneyCur
  const single = (kind === 'expense' || kind === 'income') && splits.length === 1
  const categoryLabel = kind === 'expense' ? t('quick.expenseAccount') : t('quick.incomeAccount')
  const moneyLabel = kind === 'expense' ? t('quick.paidFrom') : kind === 'income' ? t('quick.paidTo')
    : debtKind === 'borrow' || debtKind === 'collect' ? t('quick.receivedIn') : t('quick.givenFrom')
  const categories = postable.filter((a) => a.type === kind)
  const moneyList = kind === 'expense' ? [...assets, ...cards] : assets
  const picker = (key: string, list: AccountNode[], value: string, onChange: (v: string) => void, label: string) => (
    <AccountPicker accounts={list} value={value} onChange={onChange} invalid={!!show(key)} aria-label={label} className="rounded-md border border-input" />
  )

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-4"
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save() } }}
    >
      <div className="flex items-center gap-2">
      <Button type="button" variant="ghost" size="icon-sm" aria-label={t('quick.back')} title={t('quick.back')} onClick={onBack}>
        <ArrowLeftIcon />
      </Button>
      <Tabs value={kind} onValueChange={(v) => changeKind(v as QuickKind)}>
        <TabsList>
          <TabsTrigger value="expense"><TrendingDownIcon />{t('quick.kind.expense')}</TabsTrigger>
          <TabsTrigger value="income"><TrendingUpIcon />{t('quick.kind.income')}</TabsTrigger>
          <TabsTrigger value="transfer"><ArrowLeftRightIcon />{t('quick.kind.transfer')}</TabsTrigger>
          <TabsTrigger value="debt"><HandCoinsIcon />{t('quick.kind.debt')}</TabsTrigger>
        </TabsList>
      </Tabs>
      </div>

      {kind === 'debt' && (
        <ToggleGroup
          value={[debtKind]} spacing={2} className="grid w-full grid-cols-4" aria-label={t('quick.kind.debt')}
          onValueChange={(v) => { if (v[0]) { setDebtKind(v[0] as quick.DebtKind); setPerson(''); setCounter('') } }}
        >
          {DEBT_KINDS.map((m) => <ToggleGroupItem key={m} value={m} variant="outline" size="sm">{t(`quick.debtKind.${m}`)}</ToggleGroupItem>)}
        </ToggleGroup>
      )}

      {(kind === 'transfer' || kind === 'debt' || single) && (
        <Field label={t('quick.amount')} error={show(kind === 'transfer' || kind === 'debt' ? 'amount' : `amt${splits[0].key}`)}>
          <AmountInput
            autoFocus className="h-12 text-2xl font-semibold md:text-2xl" currency={heroCur} exponent={minor(heroCur)} placeholder="0,00"
            value={kind === 'transfer' || kind === 'debt' ? amount : splits[0].amount}
            invalid={!!show(kind === 'transfer' || kind === 'debt' ? 'amount' : `amt${splits[0].key}`)}
            onChange={(v) => (kind === 'transfer' || kind === 'debt' ? setAmount(v) : setSplit(splits[0].key, { amount: v }))}
          />
        </Field>
      )}

      {kind === 'debt' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('quick.person')} error={show('person')}
            hint={person.startsWith(NEW) ? t('quick.newPersonHint', { group: debtGroup?.label ?? '' }) : undefined}>
            <AccountPicker
              accounts={people} value={person} onChange={setPerson} invalid={!!show('person')} aria-label={t('quick.person')}
              creatable placeholder={t('quick.personPlaceholder')} className="rounded-md border border-input"
            />
          </Field>
          <Field label={moneyLabel} error={show('money')}>{picker('money', assets, money, setMoney, moneyLabel)}</Field>
        </div>
      )}
      {openBalance && (
        <p className="text-sm text-muted-foreground">
          {t(receivable ? 'quick.openReceivable' : 'quick.openPayable')}: <span className="text-foreground tabular-nums">{fmt(openBalance.value, openBalance.cur)} {openBalance.cur}</span>
        </p>
      )}

      {kind === 'transfer' && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <Field label={t('quick.from')} error={show('from')}>{picker('from', assets, from, setFrom, t('quick.from'))}</Field>
          <ArrowRightIcon className="mt-7 size-4 text-muted-foreground" aria-hidden />
          <Field label={t('quick.to')} error={show('to')}>{picker('to', [...assets, ...cards], to, setTo, t('quick.to'))}</Field>
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
          <Field label={t('quick.account')} error={show('money')}>{picker('money', moneyList, money, setMoney, t('quick.account'))}</Field>
          <Field label={categoryLabel} error={show(`acc${splits[0].key}`)}>
            {picker(`acc${splits[0].key}`, categories, splits[0].account, (v) => setSplit(splits[0].key, { account: v }), categoryLabel)}
          </Field>
        </div>
      ) : (
        <Field label={t('quick.account')} error={show('money')}>{picker('money', moneyList, money, setMoney, t('quick.account'))}</Field>
      ))}

      <div className="flex items-start gap-3">
        <Field label={t('gj.date')} error={show('date')}>
          <Input type="date" className="w-40" value={date} aria-invalid={!!show('date') || undefined} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('gj.description')} className="flex-1">
          <Input maxLength={1000} value={description} placeholder={t(`quick.example.${kind}`)} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>

      {(kind === 'expense' || kind === 'income') && (single ? (
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setSplits((all) => [...all, emptySplit()])}>
          <PlusIcon data-icon="inline-start" />{t('quick.split')}
        </Button>
      ) : (
        <div className="flex flex-col gap-1">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
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
                  <td>{picker(`acc${s.key}`, categories, s.account, (v) => setSplit(s.key, { account: v }), `${categoryLabel} ${i + 1}`)}</td>
                  <td>
                    <AmountInput
                      value={s.amount} currency={curOf(s.money || money) ?? base} exponent={minor(curOf(s.money || money) ?? base)} aria-label={t('quick.amount')}
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
          <div className="flex items-center justify-between px-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSplits((all) => [...all, emptySplit()])}>
              <PlusIcon data-icon="inline-start" />{t('quick.addAccount')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('quick.total')}: <span className="font-medium text-foreground tabular-nums">{fmt(splitTotal, moneyCur)} {moneyCur}</span>
            </span>
          </div>
        </div>
      ))}

      {warn && <p className="text-sm text-muted-foreground">{warn}</p>}

      {input && (
        <div className="flex flex-col gap-2">
          <Button type="button" variant="ghost" size="sm" className="w-fit" aria-expanded={showBooking} onClick={() => setShowBooking(!showBooking)}>
            <ChevronRightIcon data-icon="inline-start" className={showBooking ? 'rotate-90' : undefined} />
            {t('quick.showBooking')}
          </Button>
          {showBooking && <Booking input={input} label={(id) => acc(String(id))?.label ?? (id === 0 ? person.slice(NEW.length) : '')}
            currency={(id) => acc(String(id))?.currency ?? debtCur ?? base} base={base} fmt={fmt} />}
        </div>
      )}

      <div className="flex items-center gap-3 border-t pt-3">
        {saveError ? (
          <Alert variant="destructive" role="alert" className="flex-1"><AlertDescription>{errorText(saveError)}</AlertDescription></Alert>
        ) : attempted && (errorCount || buildError) ? (
          <p className="text-sm text-destructive" role="alert">{errorCount ? t('check.missing', { count: errorCount }) : buildError}</p>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="button" disabled={saving} onClick={() => void save()} title="Ctrl+Enter">
            {saving && <Spinner data-icon="inline-start" />}
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, className, children, error, hint }: { label: string; className?: string; children: ReactNode; error?: string; hint?: string }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`}>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {label}
        {children}
      </label>
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
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
