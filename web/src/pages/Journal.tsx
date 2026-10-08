import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpenIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { JournalEditor } from '@/components/journal/JournalEditor'
import { PageHeader } from '@/components/PageHeader'
import { FormError } from '@/components/PageShell'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { callFunction } from '@/lib/api'
import { lineContacts, useContacts } from '@/lib/contacts'
import { errorMessage } from '@/lib/errors'
import { entryToDraft, newDraft, today, useJournalEntries, type Draft, type JournalEntry } from '@/lib/journal'
import { flattenTree, formatAmount, useCurrencies, useLedgerAccounts, useMembers, type AccountNode } from '@/lib/ledger'
import { cn } from '@/lib/utils'

// General Journal (GnuCash "General Journal"): every entry of the period with its lines, debit/credit in the
// base currency, and the entry form on top. Only the member who entered an entry edits or deletes it.
export default function Journal({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const base = membership.group.base_currency
  const [from, setFrom] = useState(`${today().slice(0, 8)}01`)
  const [to, setTo] = useState(today())
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<JournalEntry | null>(null)

  const accounts = useLedgerAccounts()
  const members = useMembers()
  const contacts = useContacts()
  const contactById = useMemo(() => new Map((contacts.data ?? []).map((c) => [c.id, c])), [contacts.data])
  const currencies = useCurrencies()
  const entries = useJournalEntries(from, to)
  const exponents = new Map((currencies.data ?? []).map((c) => [c.code, c.exponent]))
  const baseExp = exponents.get(base) ?? 2
  const byId = useMemo(() => accounts.data?.byId ?? new Map<string, AccountNode>(), [accounts.data])
  const postable = useMemo(
    () => flattenTree(accounts.data?.roots ?? []).filter((a) => !a.is_placeholder && !a.archived_at),
    [accounts.data],
  )
  const memberName = new Map((members.data ?? []).map((m) => [m.id, m.name]))
  const fmt = (minor: number, cur = base) => formatAmount(minor, exponents.get(cur) ?? 2, i18n.language)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ledger'] })

  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(i18n.language)
    if (!q) return entries.data ?? []
    return (entries.data ?? []).filter((e) => e.description.toLocaleLowerCase(i18n.language).includes(q)
      || lineContacts(e.journal_lines, contactById).some((n) => n.toLocaleLowerCase(i18n.language).includes(q))
      || e.journal_lines.some((l) => {
        const a = byId.get(l.account_id)
        return (l.memo ?? '').toLocaleLowerCase(i18n.language).includes(q)
          || a?.name.toLocaleLowerCase(i18n.language).includes(q)
      }))
  }, [entries.data, search, byId, contactById, i18n.language])

  const totals = visible.reduce((s, e) => {
    for (const l of e.journal_lines) s[l.direction] += Number(l.base_amount)
    return s
  }, { debit: 0, credit: 0 })

  function edit(e: JournalEntry) {
    setDraft(entryToDraft(e, base, exponents))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = useMutation({
    mutationFn: (e: JournalEntry) => callFunction('journal-post', { action: 'delete', entry_id: e.id }),
    onSuccess: () => { setDeleting(null); refresh() },
  })

  return (
    <>
      <PageHeader
        title={t('gj.title')} description={t('gj.subtitle')} icon={BookOpenIcon}
        actions={!draft && <Button onClick={() => setDraft(newDraft())}><PlusIcon data-icon="inline-start" />{t('gj.new')}</Button>}
      />
      {draft && accounts.data && (
        <JournalEditor
          key={draft.entryId ?? 'new'}
          draft={draft} onChange={setDraft} accounts={postable} byId={byId} baseCurrency={base} exponents={exponents}
          onCancel={() => setDraft(null)}
          onSaved={() => { setDraft(draft.entryId ? null : newDraft()); refresh() }}
        />
      )}

      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('gj.from')}
          <Input type="date" className="h-8 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('gj.to')}
          <Input type="date" className="h-8 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <Input className="h-8 w-72" placeholder={t('gj.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="ml-auto text-sm text-muted-foreground">{t('gj.count', { count: visible.length })}</span>
      </div>

      <div className="rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th className="w-28">{t('ledger.date')}</th>
              <th>{t('gj.accountOrDescription')}</th>
              <th>{t('ledger.memo')}</th>
              <th className="w-40 !text-right">{t('ledger.debit')}</th>
              <th className="w-40 !text-right">{t('ledger.credit')}</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {entries.isLoading && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t('ledger.loading')}</td></tr>
            )}
            {!entries.isLoading && visible.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t('gj.empty')}</td></tr>
            )}
            {visible.map((e) => {
              const mine = e.member_id === membership.id
              const editing = draft?.entryId === e.id
              return (
                <Fragment key={e.id}>
                  <tr className={cn('group border-t bg-muted/20 [&>td]:px-3 [&>td]:pt-2 [&>td]:pb-1', editing && 'bg-primary/10')}>
                    <td className="font-mono tabular-nums">{new Date(e.entry_date + 'T00:00:00').toLocaleDateString(i18n.language)}</td>
                    <td colSpan={2} className="font-medium">
                      {e.description || <span className="text-muted-foreground italic">{t('gj.noDescription')}</span>}
                      {lineContacts(e.journal_lines, contactById).map((n) => (
                        <span key={n} className="ml-3 rounded bg-muted px-1.5 py-0.5 text-xs font-normal">{n}</span>
                      ))}
                      <span className="ml-3 text-xs font-normal text-muted-foreground">{memberName.get(e.member_id)}</span>
                    </td>
                    <td colSpan={2} />
                    <td className="text-right whitespace-nowrap">
                      {mine && (
                        <span className="invisible group-hover:visible">
                          <Button variant="ghost" size="icon-xs" aria-label={t('ledger.edit')} onClick={() => edit(e)}><PencilIcon /></Button>
                          <Button variant="ghost" size="icon-xs" aria-label={t('ledger.delete')} onClick={() => setDeleting(e)}><Trash2Icon /></Button>
                        </span>
                      )}
                    </td>
                  </tr>
                  {e.journal_lines.map((l) => {
                    const a = byId.get(l.account_id)
                    const cell = (side: 'debit' | 'credit') => l.direction === side ? fmt(Number(l.base_amount)) : ''
                    return (
                      <tr key={l.id} className="[&>td]:px-3 [&>td]:py-0.5">
                        <td />
                        <td className={cn(l.direction === 'credit' && 'pl-10')}>
                          {a?.name}
                          {l.currency !== base && (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {fmt(Number(l.amount), l.currency)} {l.currency} × {Number(l.fx_rate).toLocaleString(i18n.language, { maximumFractionDigits: 6 })}
                            </span>
                          )}
                        </td>
                        <td className="text-muted-foreground">{l.memo}</td>
                        <td className="text-right font-mono tabular-nums">{cell('debit')}</td>
                        <td className="text-right font-mono tabular-nums">{cell('credit')}</td>
                        <td />
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40 font-semibold [&>td]:px-3 [&>td]:py-2">
              <td colSpan={3}>{t('gj.periodTotal')}</td>
              <td className="text-right font-mono tabular-nums">{formatAmount(totals.debit, baseExp, i18n.language)}</td>
              <td className="text-right font-mono tabular-nums">{formatAmount(totals.credit, baseExp, i18n.language)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('gj.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <FormError message={remove.error ? errorMessage(t, remove.error) : null} />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('ledger.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive" disabled={remove.isPending}
              onClick={(ev) => { ev.preventDefault(); if (deleting) remove.mutate(deleting) }}
            >
              {t('ledger.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
