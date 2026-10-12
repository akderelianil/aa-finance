import { useTranslation } from 'react-i18next'
import { DataState } from '@/components/DataState'
import { EntryChanges } from '@/components/journal/EntryHistory'
import { Badge } from '@/components/reui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useOp } from '@/lib/api'
import { useFormat } from '@/lib/format'
import { useAccountTree, useBook } from '@/lib/ledger'

/** The entry behind an activity row: header and lines. A deleted entry shows its last known header from audit_log. */
export function ActivityDetail({ entryId, onClose }: { entryId: number | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { date: fmtDate } = useFormat()
  const { base, fmt } = useBook()
  const enabled = entryId !== null
  const entry = useOp('entries.get', { id: entryId ?? 0 }, { enabled })
  const audit = useOp('audit.forRow', { table: 'entries', id: entryId ?? 0 }, { enabled })
  const accounts = useOp('accounts.list', {})
  const { byId } = useAccountTree(accounts.data)

  const e = entry.data
  // Gone from the journal: the last audit row still holds date, description and reference.
  const last = audit.data?.at(-1)?.old ?? audit.data?.at(-1)?.new
  const gone = entry.isError && !!last
  const head = e ?? (gone ? { date: String(last.entry_date), description: last.description as string | null, reference: last.reference as string | null } : null)

  return (
    <Sheet open={enabled} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{e ? t('gj.entryNo', { year: e.year, number: e.number }) : t('activity.entry')}</SheetTitle>
          <SheetDescription>{head ? (head.description || t('gj.noDescription')) : ''}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          <DataState loading={entry.isPending || audit.isPending} error={entry.isError && !gone} onRetry={() => void entry.refetch()} />
          {gone && <Badge variant="destructive-light" className="self-start">{t('gj.change.deleted')}</Badge>}
          {head && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t('gj.date')}</dt>
              <dd className="tabular-nums">{fmtDate(head.date)}</dd>
              {head.reference && (<><dt className="text-muted-foreground">{t('gj.reference')}</dt><dd>{head.reference}</dd></>)}
              {e && (<><dt className="text-muted-foreground">{t('activity.author')}</dt><dd>{e.author.name}</dd></>)}
            </dl>
          )}
          {e && (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {e.lines.map((l) => {
                  const acc = byId.get(l.account)
                  const foreign = acc && acc.currency !== base
                  return (
                    <tr key={l.id} className="[&>td]:py-2">
                      <td>
                        {acc?.label}
                        {l.memo && <div className="text-xs text-muted-foreground">{l.memo}</div>}
                        {foreign && (
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {fmt(Math.abs(l.amount), acc.currency)} {acc.currency}{l.rate && ` × ${l.rate}`}
                          </div>
                        )}
                      </td>
                      <td className="w-16"><Badge variant={l.amount > 0 ? 'info-light' : 'secondary'} size="sm">{t(l.amount > 0 ? 'ledger.debit' : 'ledger.credit')}</Badge></td>
                      <td className="text-end tabular-nums">{fmt(Math.abs(l.baseAmount))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {audit.data && audit.data.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-sm font-medium">{t('gj.history')}</h3>
              <EntryChanges rows={audit.data} />
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
