import { useTranslation } from 'react-i18next'
import { DataState } from '@/components/DataState'
import { Badge } from '@/components/reui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useOp } from '@/lib/api'
import { useFormat } from '@/lib/format'
import type { Entry } from '@/lib/journal'

type Change = { at: number; actor: string; kind: 'created' | 'edited' | 'deleted'; lines?: boolean; fields: { key: Field; from: unknown; to: unknown }[] }
type Field = 'entry_date' | 'description' | 'reference'
const FIELDS: Field[] = ['entry_date', 'description', 'reference']

type AuditRow = { at: number; actor: string; op: string; old: Record<string, unknown> | null; new: Record<string, unknown> | null }

/**
 * audit_log rows of one entry → user-level changes. A create or an edit runs draft → posted in one batch;
 * the posted → draft step marks an edit (the lines were written again), the draft → posted step is not shown.
 */
function changes(rows: AuditRow[]): Change[] {
  const out: Change[] = []
  for (const r of rows) {
    const fields = r.old && r.new
      ? FIELDS.filter((k) => r.old![k] !== r.new![k]).map((key) => ({ key, from: r.old![key], to: r.new![key] }))
      : []
    if (r.op === 'insert') out.push({ at: r.at, actor: r.actor, kind: 'created', fields: [] })
    else if (r.op === 'delete') out.push({ at: r.at, actor: r.actor, kind: 'deleted', fields: [] })
    else if (r.old?.state === 'posted' && r.new?.state === 'draft') out.push({ at: r.at, actor: r.actor, kind: 'edited', lines: true, fields })
    else if (r.old?.state === r.new?.state && fields.length) out.push({ at: r.at, actor: r.actor, kind: 'edited', fields })
  }
  return out.reverse()
}

// Who created, changed or deleted this entry, newest first (from audit_log).
export function EntryHistory({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { dateTime } = useFormat()
  const audit = useOp('audit.forRow', { table: 'entries', id: entry?.id ?? 0 }, { enabled: !!entry })
  const list = audit.data ? changes(audit.data) : []
  const when = (ms: number) => dateTime(ms)
  const show = (v: unknown) => (v === null || v === '' ? '—' : String(v))

  return (
    <Sheet open={!!entry} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('gj.history')}</SheetTitle>
          <SheetDescription>{entry && t('gj.entryNo', { year: entry.year, number: entry.number })}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          <DataState loading={audit.isPending} error={audit.isError} onRetry={() => void audit.refetch()} />
          <ol className="flex flex-col divide-y text-sm">
            {list.map((c, i) => (
              <li key={i} className="flex flex-col gap-1 py-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={c.kind === 'deleted' ? 'destructive-light' : c.kind === 'created' ? 'success-light' : 'info-light'} size="sm">
                    {t(`gj.change.${c.kind}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">{when(c.at)}</span>
                </div>
                <span className="text-xs text-muted-foreground">{c.actor}</span>
                {c.lines && <span className="text-xs">{t('gj.linesRewritten')}</span>}
                {c.fields.map((f) => (
                  <span key={f.key} className="text-xs">
                    <span className="text-muted-foreground">{t(`gj.field.${f.key}`)}: </span>
                    <span className="line-through decoration-muted-foreground/60">{show(f.from)}</span> → {show(f.to)}
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </div>
      </SheetContent>
    </Sheet>
  )
}
