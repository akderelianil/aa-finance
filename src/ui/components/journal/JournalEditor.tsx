import { useQueries } from '@tanstack/react-query'
import { ChevronRightIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toBase } from '../../../core/money.ts'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { amountIssue, parseDecimal, toDecimal, toMinor, today } from '@/lib/amount'
import { call, useErrorText, useWrite } from '@/lib/api'
import type { Entry } from '@/lib/journal'
import type { AccountNode } from '@/lib/ledger'
import { cn } from '@/lib/utils'
import { AccountPicker } from './AccountPicker'
import { AmountInput } from './AmountInput'

/** `contact` is the Rehber record of a debt line; the form keeps it so an edit does not lose it. */
export type DraftLine = { key: number; account: string; memo: string; debit: string; credit: string; rate: string; base: string; contact?: number }
export type Draft = { id?: number; date: string; reference: string; description: string; lines: DraftLine[] }

let nextKey = 1
const emptyLine = (side?: 'debit' | 'credit', amount?: string): DraftLine => ({
  key: nextKey++, account: '', memo: '', rate: '', base: '',
  debit: side === 'debit' ? amount ?? '' : '', credit: side === 'credit' ? amount ?? '' : '',
})
export const newDraft = (): Draft => ({ date: today(), reference: '', description: '', lines: [emptyLine(), emptyLine()] })

/** Saved entry → form draft. A foreign line keeps its booked base amount. */
export function entryToDraft(e: Entry, base: string, byId: Map<number, AccountNode>, minor: (code: string) => number): Draft {
  return {
    id: e.id,
    date: e.date,
    reference: e.reference ?? '',
    description: e.description ?? '',
    lines: e.lines.map((l) => {
      const cur = byId.get(l.account)?.currency ?? base
      const amount = toDecimal(l.amount, minor(cur))
      return {
        ...emptyLine(), account: String(l.account), memo: l.memo ?? '', contact: l.contact ?? undefined,
        debit: l.amount > 0 ? amount : '', credit: l.amount < 0 ? amount : '',
        base: cur !== base ? toDecimal(l.baseAmount, minor(base)) : '',
      }
    }),
  }
}

type Props = {
  draft: Draft
  onChange: (d: Draft) => void
  /** Postable accounts. */
  accounts: AccountNode[]
  byId: Map<number, AccountNode>
  base: string
  minor: (code: string) => number
  fmt: (amount: number, code?: string) => string
  onSaved: () => void
  onCancel: () => void
}

// General Journal entry form (GnuCash split view): date, description, lines (account, memo, debit, credit).
// A foreign-currency line shows the rate (stored day rate suggested) and its base amount; the user types either.
// Totals and the difference are live. Save says what is missing instead of being disabled. Ctrl+Enter saves.
export function JournalEditor({ draft, onChange, accounts, byId, base, minor, fmt, onSaved, onCancel }: Props) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const baseExp = minor(base)
  const [focusKey, setFocusKey] = useState<number | null>(null)
  const [more, setMore] = useState(() => !!draft.reference || draft.lines.some((l) => l.memo))

  const setLine = (key: number, patch: Partial<DraftLine>) =>
    onChange({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) })
  const currencyOf = (l: DraftLine) => byId.get(Number(l.account))?.currency ?? base

  // Stored day rates for foreign lines (a suggestion; the API uses the same lookup).
  const foreign = [...new Set(draft.lines.filter((l) => l.account).map(currencyOf).filter((c) => c !== base))]
  const rates = useQueries({
    queries: foreign.map((currency) => ({
      queryKey: ['fx.get', { currency, date: draft.date }],
      queryFn: () => call('fx.get', { currency, date: draft.date }),
      enabled: !!draft.date,
    })),
  })
  const dayRate = new Map(foreign.map((c, i) => [c, rates[i]?.data?.rate]))

  /** Signed amounts of a line in minor units; null when not computable. */
  function lineAmounts(l: DraftLine): { amount: number; base: number } | null {
    const sign = l.debit ? 1 : l.credit ? -1 : 0
    if (!sign) return null
    const cur = currencyOf(l)
    const dec = parseDecimal(sign > 0 ? l.debit : l.credit, minor(cur))
    if (!dec) return null
    const amount = sign * toMinor(dec, minor(cur))
    if (cur === base) return { amount, base: amount }
    const typedBase = parseDecimal(l.base, baseExp)
    if (typedBase) return { amount, base: sign * toMinor(typedBase, baseExp) }
    const rate = parseDecimal(l.rate, 12) ?? dayRate.get(cur)
    return rate && /[1-9]/.test(rate) ? { amount, base: toBase(amount, rate, minor(cur), baseExp) } : null
  }

  const amounts = draft.lines.map(lineAmounts)
  const debit = amounts.reduce((s, a) => s + (a && a.base > 0 ? a.base : 0), 0)
  const credit = amounts.reduce((s, a) => s - (a && a.base < 0 ? a.base : 0), 0)
  const diff = debit - credit
  const filled = draft.lines.filter((l) => l.account || l.debit || l.credit)

  // Defensive checks: say what is missing.
  const [attempted, setAttempted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const issues = draft.lines.map((l) => {
    if (!filled.includes(l)) return { account: false, amount: false, rate: false }
    const raw = l.debit || l.credit
    return {
      account: !l.account,
      amount: !raw.trim() || !!amountIssue(raw, minor(currencyOf(l))),
      rate: !!raw.trim() && !!l.account && !lineAmounts(l),
    }
  })
  const count = (k: 'account' | 'amount' | 'rate') => issues.filter((x) => x[k]).length
  const dateError = !draft.date ? t('check.dateRequired') : null
  const reasons = [
    filled.length < 2 && t('check.lines'),
    count('account') > 0 && t('check.lineAccount', { count: count('account') }),
    count('amount') > 0 && t('check.lineAmount', { count: count('amount') }),
    count('rate') > 0 && t('check.lineRate', { count: count('rate') }),
    diff !== 0 && filled.length >= 2 && t('check.imbalance', { amount: fmt(Math.abs(diff)) }),
    dateError,
  ].filter((x): x is string => !!x)

  const post = useWrite('entries.post')
  const update = useWrite('entries.update')
  const save = draft.id ? update : post

  function submit() {
    if (save.isPending) return
    if (reasons.length) {
      setAttempted(true)
      setTimeout(() => rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 50)
      return
    }
    const lines = filled.map((l) => {
      const a = amounts[draft.lines.indexOf(l)]!
      const cur = currencyOf(l)
      return {
        account: Number(l.account),
        amount: a.amount,
        memo: l.memo.trim() || null,
        ...(l.contact !== undefined && { contact: l.contact }),
        // A foreign line sends its base amount, so what the form showed is what is booked.
        ...(cur !== base && { baseAmount: a.base }),
      }
    })
    const head = { date: draft.date, reference: draft.reference.trim() || null, description: draft.description.trim() || null }
    const done = { onSuccess: onSaved }
    if (draft.id) update.mutate({ id: draft.id, ...head, lines }, done)
    else post.mutate({ ...head, lines }, done)
  }

  function addLine() {
    // GnuCash: a new line proposes the open difference on the other side (base currency amount).
    const amount = diff === 0 ? undefined : toDecimal(Math.abs(diff), baseExp)
    const line = emptyLine(diff > 0 ? 'credit' : diff < 0 ? 'debit' : undefined, amount)
    onChange({ ...draft, lines: [...draft.lines, line] })
    setFocusKey(line.key)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submit()
    }
  }
  // Enter in the last amount field adds a line.
  const amountKeys = (l: DraftLine) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && l.key === draft.lines.at(-1)?.key) {
      e.preventDefault()
      addLine()
    }
  }

  const anyForeign = foreign.length > 0

  return (
    <div ref={rootRef} className="flex flex-col gap-4" onKeyDown={onKeyDown}>
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('gj.date')}
          <Input
            type="date" className="w-40" value={draft.date} aria-invalid={(attempted && !!dateError) || undefined}
            onChange={(e) => onChange({ ...draft, date: e.target.value })}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          {t('gj.description')}
          <Input maxLength={1000} value={draft.description} autoFocus onChange={(e) => onChange({ ...draft, description: e.target.value })} />
        </label>
        {more && (
          <label className="flex w-44 flex-col gap-1 text-xs text-muted-foreground">
            {t('gj.reference')}
            <Input maxLength={1000} value={draft.reference} onChange={(e) => onChange({ ...draft, reference: e.target.value })} />
          </label>
        )}
      </div>

      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="[&>th]:px-1 [&>th]:pb-1 [&>th]:text-left [&>th]:font-medium">
            <th className={cn(more && 'w-[34%]')}>{t('gj.account')}</th>
            {more && <th>{t('gj.memo')}</th>}
            <th className="w-36 !text-right">{t('ledger.debit')}</th>
            <th className="w-36 !text-right">{t('ledger.credit')}</th>
            {anyForeign && <th className="w-28 !text-right">{t('gj.rate')}</th>}
            {anyForeign && <th className="w-36 !text-right">{t('gj.baseAmount', { currency: base })}</th>}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {draft.lines.map((l, i) => {
            const acc = byId.get(Number(l.account))
            const cur = currencyOf(l)
            const isForeign = !!acc && cur !== base
            const a = amounts[i]
            return (
              <tr key={l.key} className="[&>td]:px-1 [&>td]:py-0.5">
                <td>
                  <AccountPicker
                    accounts={accounts} value={l.account} autoFocus={focusKey === l.key} invalid={attempted && issues[i].account}
                    aria-label={`${t('gj.account')} ${i + 1}`}
                    onChange={(v) => setLine(l.key, { account: v, rate: '', base: '' })}
                  />
                </td>
                {more && <td><Input className="h-8" maxLength={1000} value={l.memo} aria-label={t('gj.memo')} onChange={(e) => setLine(l.key, { memo: e.target.value })} /></td>}
                <td>
                  <AmountInput
                    className="h-8" value={l.debit} aria-label={t('ledger.debit')} currency={acc?.currency} exponent={minor(cur)}
                    invalid={attempted && issues[i].amount && !l.credit}
                    onChange={(v) => setLine(l.key, { debit: v, credit: '' })} onKeyDown={amountKeys(l)}
                  />
                </td>
                <td>
                  <AmountInput
                    className="h-8" value={l.credit} aria-label={t('ledger.credit')} currency={acc?.currency} exponent={minor(cur)}
                    invalid={attempted && issues[i].amount && !l.debit}
                    onChange={(v) => setLine(l.key, { credit: v, debit: '' })} onKeyDown={amountKeys(l)}
                  />
                </td>
                {anyForeign && (
                  <td>
                    {isForeign && (
                      <AmountInput
                        className="h-8" tidy={false} exponent={12} value={l.rate} aria-label={t('gj.rate')}
                        invalid={attempted && issues[i].rate} placeholder={dayRate.get(cur) ?? ''}
                        onChange={(v) => setLine(l.key, { rate: v, base: '' })}
                      />
                    )}
                  </td>
                )}
                {anyForeign && (
                  <td>
                    {isForeign && (
                      <AmountInput
                        className="h-8" exponent={baseExp} value={l.base} aria-label={t('gj.baseAmount', { currency: base })}
                        currency={base} placeholder={a ? fmt(Math.abs(a.base)) : ''}
                        onChange={(v) => setLine(l.key, { base: v, rate: '' })}
                      />
                    )}
                  </td>
                )}
                <td>
                  <Button
                    type="button" variant="ghost" size="icon-sm" aria-label={t('gj.removeLine')} tabIndex={-1}
                    disabled={draft.lines.length <= 2}
                    onClick={() => onChange({ ...draft, lines: draft.lines.filter((x) => x.key !== l.key) })}
                  >
                    <Trash2Icon />
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t text-sm [&>td]:px-3 [&>td]:pt-2">
            <td colSpan={more ? 2 : 1} className="!px-1">
              <Button type="button" variant="ghost" size="sm" onClick={addLine}>
                <PlusIcon data-icon="inline-start" />{t('gj.addLine')}
              </Button>
            </td>
            <td className="text-right font-semibold tabular-nums">{fmt(debit)}</td>
            <td className="text-right font-semibold tabular-nums">{fmt(credit)}</td>
            {anyForeign && <td colSpan={2} className="text-right text-xs text-muted-foreground">{base}</td>}
            <td />
          </tr>
        </tfoot>
      </table>

      <Button type="button" variant="ghost" size="sm" className="w-fit" aria-expanded={more} onClick={() => setMore(!more)}>
        <ChevronRightIcon data-icon="inline-start" className={cn(more && 'rotate-90')} />
        {t('gj.details')}
      </Button>

      <div className="flex items-center gap-3 border-t pt-3">
        {filled.length > 0 && (diff === 0
          ? <Badge variant="success-light">{t('gj.balanced')}</Badge>
          : <Badge variant="destructive-light">{t('gj.imbalance', { amount: fmt(Math.abs(diff)), side: t(diff > 0 ? 'ledger.debit' : 'ledger.credit') })}</Badge>)}
        {save.error ? (
          <Alert variant="destructive" role="alert" className="flex-1"><AlertDescription>{errorText(save.error)}</AlertDescription></Alert>
        ) : attempted && reasons.length > 0 ? (
          <ul className="flex flex-col text-sm text-destructive" role="alert">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        ) : null}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button type="button" disabled={save.isPending} onClick={submit} title="Ctrl+Enter">
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
