import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameFooter, FramePanel } from '@/components/reui/frame'
import {
  Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator,
} from '@/components/reui/timeline'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ActivityDetail } from '@/components/ActivityDetail'
import { ApiError, useErrorText, useOp } from '@/lib/api'
import { useFormat } from '@/lib/format'

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g
const FIRST = 10
const MORE = 20

const initials = (name: string) => name.split(/\s+/).map((n) => n[0]).join('').slice(0, 2).toLocaleUpperCase()

// Activity log (who did what), newest first. Only writes are logged; old rows are pruned by the setting.
// Opens on the latest 10; "load more" asks SQL for a longer first page, so the screen never holds the whole log.
export default function Activity() {
  const { t, i18n } = useTranslation()
  const { dateTime } = useFormat()
  const errorText = useErrorText()
  const [shown, setShown] = useState(FIRST)
  const [entryId, setEntryId] = useState<number | null>(null)
  const log = useOp('activity.list', { page: 0, pageSize: shown }, { keep: true })
  const rows = log.data?.rows ?? []
  const total = log.data?.total ?? 0

  return (
    <>
      <PageHeader title={t('nav.activity')} description={t('activity.subtitle')} />
      <Frame spacing="sm" stacked>
        <FramePanel>
          {log.isPending ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: FIRST }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : log.isError ? (
            <Empty>
              <EmptyHeader><EmptyTitle>{t('state.error')}</EmptyTitle></EmptyHeader>
              <Button variant="outline" size="sm" onClick={() => log.refetch()}>{t('state.retry')}</Button>
            </Empty>
          ) : rows.length === 0 ? (
            <Empty><EmptyHeader><EmptyTitle>{t('activity.empty')}</EmptyTitle></EmptyHeader></Empty>
          ) : (
            <Timeline defaultValue={0}>
              {rows.map((r, i) => {
                const key = `activity.op.${r.operation.replace('.', '_')}`
                // Record uids in the summary mean nothing to a reader; a failure shows its reason instead.
                // An entry action links to the entry: its summary is the entry id.
                const entry = r.ok && r.operation.startsWith('entries.') && /^\d+$/.test(r.summary ?? '') ? Number(r.summary) : null
                const detail = entry ? null : r.ok ? r.summary?.replace(UUID, '').replace(/\s+/g, ' ').trim() : errorText(new ApiError(r.errorCode ?? 'internal'))
                return (
                  <TimelineItem key={`${r.at}-${i}`} step={i + 1} className="group-data-[orientation=vertical]/timeline:ms-10">
                    <TimelineHeader>
                      <TimelineSeparator className="bg-input! group-data-[orientation=vertical]/timeline:top-2 group-data-[orientation=vertical]/timeline:-left-8 group-data-[orientation=vertical]/timeline:h-[calc(100%-2.5rem)] group-data-[orientation=vertical]/timeline:translate-y-7" />
                      <TimelineIndicator className="size-8 overflow-hidden rounded-full border-none group-data-[orientation=vertical]/timeline:-left-8">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-xs">{initials(r.actor)}</AvatarFallback>
                        </Avatar>
                      </TimelineIndicator>
                    </TimelineHeader>
                    <TimelineContent>
                      <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
                        <span className="font-medium text-foreground">{r.actor}</span>
                        {(() => {
                          const label = i18n.exists(key) ? t(key as 'activity.op.entries_post') : r.operation
                          return entry
                            ? <button type="button" className="text-primary underline-offset-4 transition-colors hover:underline" onClick={() => setEntryId(entry)}>{label}</button>
                            : <span className="text-muted-foreground">{label}</span>
                        })()}
                        {detail && <span className="font-medium text-foreground">{detail}</span>}
                        {!r.ok && <Badge variant="destructive-light">{t('activity.failed')}</Badge>}
                      </p>
                      <TimelineDate className="mt-0.5 mb-0 tabular-nums">
                        {dateTime(r.at, true)}{r.durationMs !== null && ` · ${r.durationMs} ms`}
                      </TimelineDate>
                    </TimelineContent>
                  </TimelineItem>
                )
              })}
            </Timeline>
          )}
        </FramePanel>
        {total > 0 && (
          <FrameFooter className="flex-row items-center gap-4 py-1.5 pr-2 pl-2.5 text-xs text-muted-foreground">
            <span>{t('activity.shown', { shown: Math.min(rows.length, total), total })}</span>
            {rows.length < total && (
              <Button variant="outline" size="sm" className="ms-auto" disabled={log.isFetching} onClick={() => setShown((n) => n + MORE)}>
                {t('activity.more')}
              </Button>
            )}
          </FrameFooter>
        )}
      </Frame>
      <ActivityDetail entryId={entryId} onClose={() => setEntryId(null)} />
    </>
  )
}
