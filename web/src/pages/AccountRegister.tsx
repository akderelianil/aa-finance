import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, NotebookTextIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
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
import { emptyLine, entryToDraft, today, useAccountEntries, type Draft, type JournalEntry } from '@/lib/journal'
import {
  flattenTree, formatAmount, fullName, shown, useCurrencies, useLedgerAccounts, type AccountNode,
} from '@/lib/ledger'
import { cn } from '@/lib/utils'

// Account Register (GnuCash register): one row per line on the account with the other account, debit, credit
// and the running balance in the account currency (normal sign of the account type).
export default function AccountRegister({ membership }: { membership: Membership }) {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const base = membership.group.base_currency
  const accounts = useLedgerAccounts()
  const currencies = useCurrencies()
  const entries = useAccountEntries(id)
  const contacts = useContacts()
  const contactById = useMemo(() => new Map((contacts.data ?? []).map((c) => [c.id, c])), [contacts.data])
  const exponents = new Map((currencies.data ?? []).map((c) => [c.code, c.exponent]))
  const byId = useMemo(() => accounts.data?.byId ?? new Map<string, AccountNode>(), [accounts.data])
  const account = id ? byId.get(id) : undefined
  const postable = useMemo(
    () => flattenTree(accounts.data?.roots ?? []).filter((a) => !a.is_placeholder && !a.archived_at),
    [accounts.data],
  )
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<JournalEntry | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ledger'] })
  const exp = account ? exponents.get(account.currency) ?? 2 : 2
  const fmt = (minor: number) => formatAmount(minor, exp, i18n.language)

  // Rows with the running balance over all lines; the date range only hides rows (opening = balance before).
  const { rows, opening } = useMemo(() => {
    if (!account) return { rows: [], opening: 0 }
    let balance = 0
    let opening = 0
    const rows: { entry: JournalEntry; lineId: string; debit: number; credit: number; memo: string | null; other: string; balance: number }[] = []
    for (const e of entries.data ?? []) {
      for (const l of e.journal_lines.filter((x) => x.account_id === account.id)) {
        const amount = Number(l.amount)
        balance += shown(account.type, l.direction === 'debit' ? amount : -amount)
        if (from && e.entry_date < from) { opening = balance; continue }
        if (to && e.entry_date > to) continue
        const others = e.journal_lines.filter((x) => x.account_id !== account.id)
        const o = others.length === 1 ? byId.get(others[0].account_id) : undefined
        rows.push({
          entry: e, lineId: l.id, memo: l.memo, balance,
          debit: l.direction === 'debit' ? amount : 0, credit: l.direction === 'credit' ? amount : 0,
          other: o ? `${o.code} ${o.name}` : others.length ? t('reg.split') : '',
        })
      }
    }
    return { rows, opening }
  }, [account, entries.data, from, to, byId, t])

  const remove = useMutation({
    mutationFn: (e: JournalEntry) => callFunction('journal-post', { action: 'delete', entry_id: e.id }),
    onSuccess: () => { setDeleting(null); refresh() },
  })

  const newEntry = () => setDraft({
    date: today(), description: '', lines: [{ ...emptyLine(), accountId: account!.id }, emptyLine()],
  })

  if (accounts.isLoading) return <p className="text-muted-foreground">{t('ledger.loading')}</p>
  if (!account) return <p className="text-muted-foreground">{t('reg.notFound')}</p>
  const total = shown(account.type, account.net)

  return (
    <>
      <Button variant="ghost" size="sm" className="self-start" nativeButton={false} render={<Link to="/hesaplar" />}>
        <ArrowLeftIcon data-icon="inline-start" />{t('coa.title')}
      </Button>
      <PageHeader
        title={`${account.code} ${account.name}`}
        description={`${fullName(account, byId)} · ${t(`ledger.type.${account.type}`)} · ${account.currency}`}
        icon={NotebookTextIcon}
        actions={(
          <>
            <div className="mr-4 text-right">
              <div className="text-xs text-muted-foreground">{t('ledger.balance')}</div>
              <div className={cn('font-mono text-xl font-semibold tabular-nums', total < 0 && 'text-destructive')}>
                {fmt(total)} <span className="text-sm text-muted-foreground">{account.currency}</span>
              </div>
            </div>
            {!draft && !account.is_placeholder && !account.archived_at && (
              <Button onClick={newEntry}><PlusIcon data-icon="inline-start" />{t('gj.new')}</Button>
            )}
          </>
        )}
      />
      {draft && (
        <JournalEditor
          key={draft.entryId ?? 'new'}
          draft={draft} onChange={setDraft} accounts={postable} byId={byId} baseCurrency={base} exponents={exponents}
          onCancel={() => setDraft(null)}
          onSaved={() => { setDraft(null); refresh() }}
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
      </div>

      <div className="rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th className="w-28">{t('ledger.date')}</th>
              <th>{t('ledger.description')}</th>
              <th>{t('reg.other')}</th>
              <th>{t('ledger.memo')}</th>
              <th className="w-36 !text-right">{t('ledger.debit')}</th>
              <th className="w-36 !text-right">{t('ledger.credit')}</th>
              <th className="w-40 !text-right">{t('ledger.balance')}</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr>td]:px-3 [&>tr>td]:py-1.5">
            {from && (
              <tr className="bg-muted/20 text-muted-foreground">
                <td colSpan={6}>{t('reg.opening')}</td>
                <td className="text-right font-mono tabular-nums">{fmt(opening)}</td>
                <td />
              </tr>
            )}
            {entries.isLoading && <tr><td colSpan={8} className="text-center text-muted-foreground">{t('ledger.loading')}</td></tr>}
            {!entries.isLoading && rows.length === 0 && <tr><td colSpan={8} className="text-center text-muted-foreground">{t('gj.empty')}</td></tr>}
            {rows.map((r) => {
              const mine = r.entry.member_id === membership.id
              return (
                <tr key={r.lineId} className={cn('group', draft?.entryId === r.entry.id && 'bg-primary/10')}>
                  <td className="font-mono tabular-nums">{new Date(r.entry.entry_date + 'T00:00:00').toLocaleDateString(i18n.language)}</td>
                  <td>
                    {r.entry.description}
                    {lineContacts(r.entry.journal_lines, contactById).map((n) => (
                      <span key={n} className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{n}</span>
                    ))}
                  </td>
                  <td className={cn(r.other === t('reg.split') && 'italic text-muted-foreground')}>{r.other}</td>
                  <td className="text-muted-foreground">{r.memo}</td>
                  <td className="text-right font-mono tabular-nums">{r.debit ? fmt(r.debit) : ''}</td>
                  <td className="text-right font-mono tabular-nums">{r.credit ? fmt(r.credit) : ''}</td>
                  <td className={cn('text-right font-mono tabular-nums', r.balance < 0 && 'text-destructive')}>{fmt(r.balance)}</td>
                  <td className="text-right whitespace-nowrap">
                    {mine && (
                      <span className="invisible group-hover:visible">
                        <Button variant="ghost" size="icon-xs" aria-label={t('ledger.edit')} onClick={() => setDraft(entryToDraft(r.entry, base, exponents))}><PencilIcon /></Button>
                        <Button variant="ghost" size="icon-xs" aria-label={t('ledger.delete')} onClick={() => setDeleting(r.entry)}><Trash2Icon /></Button>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
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
