import { useTable, type ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/reui/badge'
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { Frame, FrameFooter, FramePanel } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, useErrorText, useOp } from '@/lib/api'
import { useFormat } from '@/lib/format'
import { PAGE_SIZES, useGridI18n, useServerPages } from '@/lib/grid'
import type { Output } from '../../core/api/index.ts'

type Row = Output<'activity.list'>['rows'][number]

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g

// Activity log (who did what), newest first. Only writes are logged; old rows are pruned by the setting.
export default function Activity() {
  const { t, i18n } = useTranslation()
  const { dateTime } = useFormat()
  const [total, setTotal] = useState<number>()
  const pages = useServerPages('activity', total)
  const log = useOp('activity.list', { page: pages.page ?? 0, pageSize: pages.pageSize }, { keep: true })
  if (log.data && log.data.total !== total) setTotal(log.data.total)
  const gridI18n = useGridI18n()
  const errorText = useErrorText()

  const columns = useMemo<ColumnDef<DataGridFeatures, Row>[]>(() => [
    {
      id: 'at', size: 180, enableSorting: false,
      header: ({ column }) => <DataGridColumnHeader title={t('activity.at')} column={column} />,
      cell: ({ row: { original: r } }) => (
        <span className="tabular-nums">{dateTime(r.at, true)}</span>
      ),
      meta: { skeleton: <Skeleton className="h-4 w-32" /> },
    },
    {
      id: 'actor', size: 140, enableSorting: false,
      header: ({ column }) => <DataGridColumnHeader title={t('activity.actor')} column={column} />,
      cell: ({ row: { original: r } }) => r.actor,
      meta: { skeleton: <Skeleton className="h-4 w-20" /> },
    },
    {
      id: 'operation', size: 360, enableSorting: false,
      header: ({ column }) => <DataGridColumnHeader title={t('activity.operation')} column={column} />,
      cell: ({ row: { original: r } }) => {
        const key = `activity.op.${r.operation.replace('.', '_')}`
        // Record uids in the summary mean nothing to a reader; a failure shows its reason instead.
        const detail = r.ok ? r.summary?.replace(UUID, '').replace(/\s+/g, ' ').trim() : errorText(new ApiError(r.errorCode ?? 'internal'))
        return (
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-medium">{i18n.exists(key) ? t(key as 'activity.op.entries_post') : r.operation}</span>
            {detail && <span className="truncate text-muted-foreground">{detail}</span>}
          </span>
        )
      },
      meta: { skeleton: <Skeleton className="h-4 w-48" /> },
    },
    {
      id: 'result', size: 160, enableSorting: false,
      header: ({ column }) => <DataGridColumnHeader title={t('activity.result')} column={column} />,
      cell: ({ row: { original: r } }) => r.ok
        ? <Badge variant="success-light">{t('activity.ok')}</Badge>
        : <Badge variant="destructive-light">{t('activity.failed')}</Badge>,
      meta: { skeleton: <Skeleton className="h-5 w-16" /> },
    },
    {
      id: 'duration', size: 100, enableSorting: false,
      header: ({ column }) => <DataGridColumnHeader title={t('activity.duration')} column={column} />,
      cell: ({ row: { original: r } }) => (r.durationMs === null ? '' : `${r.durationMs} ms`),
      meta: { headerClassName: 'text-end [&>div]:justify-end', cellClassName: 'text-end tabular-nums text-muted-foreground', skeleton: <Skeleton className="ml-auto h-4 w-10" /> },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, i18n.language, dateTime])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: log.data?.rows ?? [],
    manualPagination: true,
    rowCount: log.data?.total ?? 0,
    state: { pagination: pages.pagination },
    onPaginationChange: pages.onPaginationChange,
    autoResetPageIndex: false,
  })

  return (
    <>
      <PageHeader title={t('nav.activity')} description={t('activity.subtitle')} />
      <DataGrid
        table={table}
        recordCount={log.data?.total ?? 0}
        isLoading={log.isPending}
        tableLayout={{ dense: true, headerBackground: false }}
        emptyMessage={log.isError ? (
          <Empty>
            <EmptyHeader><EmptyTitle>{t('state.error')}</EmptyTitle></EmptyHeader>
            <Button variant="outline" size="sm" onClick={() => log.refetch()}>{t('state.retry')}</Button>
          </Empty>
        ) : (
          <Empty><EmptyHeader><EmptyTitle>{t('activity.empty')}</EmptyTitle></EmptyHeader></Empty>
        )}
        i18n={gridI18n}
      >
        <Frame spacing="sm" stacked>
          <FramePanel className="p-0">
            <DataGridContainer>
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
          </FramePanel>
          <FrameFooter className="flex-row items-center gap-4 py-1.5 pr-2 pl-2.5 text-xs text-muted-foreground">
            <DataGridPagination sizes={PAGE_SIZES} />
          </FrameFooter>
        </Frame>
      </DataGrid>
    </>
  )
}
