import { useMutation, useQueries } from '@tanstack/react-query'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { emptyLine, today, type Draft, type DraftLine } from '@/lib/journal'
import { formatAmount, parseDecimalInput, toMinor, type AccountNode } from '@/lib/ledger'
import { cn } from '@/lib/utils'
import { AccountPicker } from './AccountPicker'

type Props = {
  draft: Draft
  onChange: (d: Draft) => void
  accounts: AccountNode[] // postable
  byId: Map<string, AccountNode>
  baseCurrency: string
  exponents: Map<string, number>
  onSaved: () => void
  onCancel: () => void
}

// General Journal entry form (GnuCash split view): date, description, lines (account, memo, debit, credit).
// A foreign-currency line shows the rate (day rate suggested) and its base amount; the user can type either.
// Totals and the imbalance are live; the entry saves only when balanced. Ctrl+Enter saves.
export function JournalEditor({ draft, onChange, accounts, byId, baseCurrency, exponents, onSaved, onCancel }: Props) {
  const { t, i18n } = useTranslation()
  const baseExp = exponents.get(baseCurrency) ?? 2
  const expOf = (cur: string) => exponents.get(cur) ?? 2
  const [focusKey, setFocusKey] = useState<number | null>(null)

  const setLine = (key: number, patch: Partial<DraftLine>) =>
    onChange({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) })

  // Day rates for foreign lines (suggestion; the server uses the same lookup).
  const foreign = [...new Set(draft.lines.map((l) => byId.get(l.accountId)?.currency)
    .filter((c): c is string => !!c && c !== baseCurrency))]
  const rates = useQueries({
    queries: foreign.map((currency) => ({
      queryKey: ['fx-rate', currency, draft.date],
      queryFn: () => callFunction<{ rate: string }>('fx-rate', { currency, date: draft.date }),
      retry: false,
      staleTime: 60 * 60 * 1000,
    })),
  })
  const dayRate = new Map(foreign.map((c, i) => [c, rates[i]?.data?.rate]))

  // Base amount (minor) of a line for the live totals; null when not computable.
  function lineBase(l: DraftLine): { side: 'debit' | 'credit'; base: number } | null {
    const acc = byId.get(l.accountId)
    const side = l.debit ? 'debit' : l.credit ? 'credit' : null
    if (!side) return null
    const cur = acc?.currency ?? baseCurrency
    const amount = parseDecimalInput(side === 'debit' ? l.debit : l.credit, expOf(cur))
    if (!amount) return null
    if (cur === baseCurrency) return { side, base: toMinor(amount, baseExp) }
    const base = parseDecimalInput(l.base, baseExp)
    if (base) return { side, base: toMinor(base, baseExp) }
    const rate = parseDecimalInput(l.rate, 10) ?? dayRate.get(cur)
    if (!rate) return null
    return { side, base: Math.round(toMinor(amount, expOf(cur)) * Number(rate) * 10 ** baseExp / 10 ** expOf(cur)) }
  }

  const bases = draft.lines.map(lineBase)
  const debit = bases.reduce((s, b) => s + (b?.side === 'debit' ? b.base : 0), 0)
  const credit = bases.reduce((s, b) => s + (b?.side === 'credit' ? b.base : 0), 0)
  const diff = debit - credit
  const filled = draft.lines.filter((l) => l.accountId || l.debit || l.credit)
  const invalid = filled.some((l) => !l.accountId || (!l.debit && !l.credit))
  const ready = filled.length >= 2 && !invalid && diff === 0 && bases.every((b, i) => b || !filled.includes(draft.lines[i]))

  function addLine() {
    // GnuCash: a new line proposes the open difference on the other side.
    const amount = diff === 0 ? undefined : formatAmount(Math.abs(diff), baseExp, 'en').replace(/,/g, '')
    const line = emptyLine(diff > 0 ? 'credit' : diff < 0 ? 'debit' : undefined, amount)
    onChange({ ...draft, lines: [...draft.lines, line] })
    setFocusKey(line.key)
  }

  const save = useMutation({
    mutationFn: () => callFunction<{ entry_id: string }>('journal-post', {
      action: draft.entryId ? 'update' : 'create',
      entry_id: draft.entryId,
      date: draft.date,
      description: draft.description.trim(),
      lines: filled.map((l) => {
        const cur = byId.get(l.accountId)?.currency ?? baseCurrency
        const side = l.debit ? 'debit' : 'credit'
        return {
          account_id: l.accountId,
          side,
          amount: parseDecimalInput(side === 'debit' ? l.debit : l.credit, expOf(cur)),
          memo: l.memo.trim() || undefined,
          ...(cur !== baseCurrency && parseDecimalInput(l.base, baseExp) ? { base_amount: parseDecimalInput(l.base, baseExp) } : {}),
          ...(cur !== baseCurrency && !l.base && parseDecimalInput(l.rate, 10) ? { rate: parseDecimalInput(l.rate, 10) } : {}),
        }
      }),
    }),
    onSuccess: onSaved,
  })

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (ready && !save.isPending) save.mutate()
    }
  }
  // Enter in the last amount field adds a line.
  const amountKeys = (l: DraftLine) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && l.key === draft.lines.at(-1)?.key) {
      e.preventDefault()
      addLine()
    }
  }

  const fmt = (minor: number) => formatAmount(minor, baseExp, i18n.language)
  const anyForeign = foreign.length > 0
  const amountCls = 'h-8 text-right font-mono tabular-nums'

  return (
    <div className="rounded-xl border bg-card p-4" onKeyDown={onKeyDown}>
      <div className="mb-3 flex items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('ledger.date')}
          <Input type="date" className="h-8 w-40" value={draft.date} max={today()} onChange={(e) => onChange({ ...draft, date: e.target.value })} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          {t('ledger.description')}
          <Input
            className="h-8" maxLength={200} value={draft.description} autoFocus
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
          />
        </label>
        {draft.entryId && <span className="pb-2 text-sm font-medium text-primary">{t('gj.editing')}</span>}
      </div>

      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="[&>th]:px-1 [&>th]:pb-1 [&>th]:text-left [&>th]:font-medium">
            <th className="w-[34%]">{t('ledger.account')}</th>
            <th>{t('ledger.memo')}</th>
            <th className="w-36 !text-right">{t('ledger.debit')}</th>
            <th className="w-36 !text-right">{t('ledger.credit')}</th>
            {anyForeign && <th className="w-28 !text-right">{t('ledger.rate')}</th>}
            {anyForeign && <th className="w-36 !text-right">{t('gj.baseAmount', { currency: baseCurrency })}</th>}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {draft.lines.map((l, i) => {
            const acc = byId.get(l.accountId)
            const isForeign = !!acc && acc.currency !== baseCurrency
            const b = bases[i]
            return (
              <tr key={l.key} className="[&>td]:px-1 [&>td]:py-0.5">
                <td>
                  <AccountPicker
                    accounts={accounts} value={l.accountId} autoFocus={focusKey === l.key}
                    aria-label={`${t('ledger.account')} ${i + 1}`}
                    onChange={(id) => setLine(l.key, { accountId: id, rate: '', base: '' })}
                  />
                </td>
                <td><Input className="h-8" maxLength={200} value={l.memo} onChange={(e) => setLine(l.key, { memo: e.target.value })} /></td>
                <td>
                  <div className="relative">
                    <Input
                      className={amountCls} inputMode="decimal" value={l.debit} aria-label={t('ledger.debit')}
                      onChange={(e) => setLine(l.key, { debit: e.target.value, credit: '' })} onKeyDown={amountKeys(l)}
                    />
                    {isForeign && <span className="pointer-events-none absolute top-2 left-2 text-[10px] text-muted-foreground">{acc.currency}</span>}
                  </div>
                </td>
                <td>
                  <div className="relative">
                    <Input
                      className={amountCls} inputMode="decimal" value={l.credit} aria-label={t('ledger.credit')}
                      onChange={(e) => setLine(l.key, { credit: e.target.value, debit: '' })} onKeyDown={amountKeys(l)}
                    />
                    {isForeign && <span className="pointer-events-none absolute top-2 left-2 text-[10px] text-muted-foreground">{acc.currency}</span>}
                  </div>
                </td>
                {anyForeign && (
                  <td>
                    {isForeign && (
                      <Input
                        className={amountCls} inputMode="decimal" value={l.rate} aria-label={t('ledger.rate')}
                        placeholder={dayRate.get(acc.currency) ?? ''}
                        onChange={(e) => setLine(l.key, { rate: e.target.value, base: '' })}
                      />
                    )}
                  </td>
                )}
                {anyForeign && (
                  <td>
                    {isForeign && (
                      <Input
                        className={amountCls} inputMode="decimal" value={l.base} aria-label={t('gj.baseAmount', { currency: baseCurrency })}
                        placeholder={b ? fmt(b.base) : ''}
                        onChange={(e) => setLine(l.key, { base: e.target.value, rate: '' })}
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
            <td colSpan={2} className="!px-1">
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <PlusIcon data-icon="inline-start" />{t('gj.addLine')}
              </Button>
            </td>
            <td className="text-right font-mono tabular-nums font-semibold">{fmt(debit)}</td>
            <td className="text-right font-mono tabular-nums font-semibold">{fmt(credit)}</td>
            {anyForeign && <td colSpan={2} />}
            <td />
          </tr>
        </tfoot>
      </table>

      <div className="mt-3 flex items-center gap-3">
        <span className={cn('text-sm', diff === 0 ? 'text-muted-foreground' : 'font-medium text-destructive')}>
          {diff !== 0
            ? t('gj.imbalance', { amount: fmt(Math.abs(diff)), side: t(diff > 0 ? 'ledger.debit' : 'ledger.credit') })
            : filled.length > 0 && t('gj.balanced')}
        </span>
        <FormError message={save.error ? errorMessage(t, save.error) : null} />
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>{t('ledger.cancel')}</Button>
          <Button type="button" disabled={!ready || save.isPending} onClick={() => save.mutate()} title="Ctrl+Enter">
            {save.isPending && <Spinner data-icon="inline-start" />}
            {t('ledger.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
