import { useMutation, useQueries } from '@tanstack/react-query'
import { ChevronRightIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FormError } from '@/components/PageShell'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useContacts } from '@/lib/contacts'
import { draftContact, emptyLine, today, type Draft, type DraftLine } from '@/lib/journal'
import { scaleMinor } from '@/lib/quick'
import { formatAmount, parseDecimalInput, toMinor, type AccountNode } from '@/lib/ledger'
import { cn } from '@/lib/utils'
import { AccountPicker } from './AccountPicker'
import { TagsField } from '@/components/journal/TagsField'
import { ContactPicker } from './ContactPicker'

type Props = {
  draft: Draft
  onChange: (d: Draft) => void
  accounts: AccountNode[] // postable
  byId: Map<string, AccountNode>
  baseCurrency: string
  groupId: string
  exponents: Map<string, number>
  onSaved: () => void
  onCancel: () => void
  /** No own border and padding, for use inside a dialog. */
  bare?: boolean
}

// General Journal entry form (GnuCash split view): date, description, Rehber, lines (account, memo, debit, credit).
// The Rehber field tags every line with one contact; an entry with several contacts keeps them until it is changed.
// A foreign-currency line shows the rate (day rate suggested) and its base amount; the user can type either.
// Totals and the imbalance are live; the entry saves only when balanced. Ctrl+Enter saves.
export function JournalEditor({ draft, onChange, accounts, byId, baseCurrency, groupId, exponents, onSaved, onCancel, bare }: Props) {
  const { t, i18n } = useTranslation()
  const baseExp = exponents.get(baseCurrency) ?? 2
  const expOf = (cur: string) => exponents.get(cur) ?? 2
  const [focusKey, setFocusKey] = useState<number | null>(null)
  const contacts = useContacts()
  const activeContacts = (contacts.data ?? []).filter((c) => !c.archived_at || draft.lines.some((l) => l.contactId === c.id))
  const contact = draftContact(draft.lines)
  // Progressive disclosure: contact, tags and line memos stay hidden until asked for, or when the entry already has them.
  const [more, setMore] = useState(() => !!contact || draft.tags.length > 0 || draft.lines.some((l) => l.memo))

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
    const scaled = scaleMinor(toMinor(amount, expOf(cur)), rate, expOf(cur), baseExp)
    return scaled === null ? null : { side, base: scaled }
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
    const line = { ...emptyLine(diff > 0 ? 'credit' : diff < 0 ? 'debit' : undefined, amount), contactId: contact === 'mixed' ? '' : contact }
    onChange({ ...draft, lines: [...draft.lines, line] })
    setFocusKey(line.key)
  }

  const save = useMutation({
    mutationFn: () => callFunction<{ entry_id: string }>('journal-post', {
      action: draft.entryId ? 'update' : 'create',
      entry_id: draft.entryId,
      date: draft.date,
      description: draft.description.trim(),
      tags: draft.tags,
      lines: filled.map((l) => {
        const cur = byId.get(l.accountId)?.currency ?? baseCurrency
        const side = l.debit ? 'debit' : 'credit'
        return {
          account_id: l.accountId,
          side,
          amount: parseDecimalInput(side === 'debit' ? l.debit : l.credit, expOf(cur)),
          memo: l.memo.trim() || undefined,
          contact_id: l.contactId || undefined,
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
    <div className={cn(!bare && 'rounded-xl border bg-card p-4')} onKeyDown={onKeyDown}>
      <div className="mb-4 flex items-end gap-3">
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
      </div>

      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="[&>th]:px-1 [&>th]:pb-1 [&>th]:text-left [&>th]:font-medium">
            <th className={cn(more && 'w-[34%]')}>{t('ledger.account')}</th>
            {more && <th>{t('ledger.memo')}</th>}
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
                {more && <td><Input className="h-8" maxLength={200} value={l.memo} onChange={(e) => setLine(l.key, { memo: e.target.value })} /></td>}
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
            <td colSpan={more ? 2 : 1} className="!px-1">
              <Button type="button" variant="ghost" size="sm" onClick={addLine}>
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

      <div className="mt-3 flex flex-col gap-3">
        <Button
          type="button" variant="ghost" size="sm" className="w-fit" aria-expanded={more}
          onClick={() => setMore(!more)}
        >
          <ChevronRightIcon data-icon="inline-start" className={cn(more && 'rotate-90')} />
          {t('gj.details')}
        </Button>
        {more && (
          <div className="grid grid-cols-[14rem_minmax(0,1fr)] items-start gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t('directory.field')}
              <ContactPicker
                contacts={activeContacts} value={contact === 'mixed' ? '' : contact} aria-label={t('directory.field')}
                placeholder={contact === 'mixed' ? t('directory.mixed') : undefined}
                className="rounded-md border border-input text-foreground"
                onChange={(id) => onChange({ ...draft, lines: draft.lines.map((l) => ({ ...l, contactId: id })) })}
              />
            </label>
            <TagsField value={draft.tags} onChange={(tags) => onChange({ ...draft, tags })} groupId={groupId} />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3 border-t pt-3">
        {filled.length > 0 && (diff === 0
          ? <Badge variant="success-light">{t('gj.balanced')}</Badge>
          : <Badge variant="destructive-light">{t('gj.imbalance', { amount: fmt(Math.abs(diff)), side: t(diff > 0 ? 'ledger.debit' : 'ledger.credit') })}</Badge>)}
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
