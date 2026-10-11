import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTable, type ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataState } from '@/components/DataState'
import { FormError } from '@/components/PageShell'
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { levelOf, useMemberAccess, type AccessLevel } from '@/lib/access'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useMembers } from '@/lib/ledger'

const LEVELS: AccessLevel[] = ['view', 'edit', 'delete']

type Row = { id: string; whoId: string; who: string; first: boolean; ownerId: string; owner: string; rank: number }

// Admin only: what each member may do with each other member's journal entries. Everyone always views.
export function MemberAccessCard() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const members = useMembers()
  const access = useMemberAccess()
  const set = useMutation({
    mutationFn: (body: { member_id: string; target_member_id: string; level: AccessLevel }) =>
      callFunction('member-access-set', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ledger', 'member-access'] }),
  })
  const all = useMemo(() => members.data ?? [], [members.data])
  const loading = members.isPending || access.isPending
  const failed = members.isError || access.isError

  // Admins can always change every entry; only members get a setting.
  const data = useMemo<Row[]>(() => all.filter((m) => m.role !== 'admin').flatMap((who) =>
    all.filter((o) => o.id !== who.id).map((owner, i) => ({
      id: `${who.id}-${owner.id}`, whoId: who.id, who: who.name, first: i === 0,
      ownerId: owner.id, owner: owner.name, rank: LEVELS.indexOf(levelOf(access.data ?? [], who.id, owner.id)),
    })),
  ), [all, access.data])

  const columns = useMemo<ColumnDef<DataGridFeatures, Row>[]>(() => [
    {
      id: 'who', header: t('access.member'), minSize: 160, enableSorting: false,
      cell: ({ row: { original: r } }) => <span className="font-medium">{r.first ? r.who : ''}</span>,
      meta: { skeleton: <Skeleton className="h-4 w-28" /> },
    },
    {
      id: 'owner', header: t('access.owner'), minSize: 160, enableSorting: false,
      cell: ({ row: { original: r } }) => <span className="text-muted-foreground">{r.owner}</span>,
      meta: { skeleton: <Skeleton className="h-4 w-28" /> },
    },
    ...LEVELS.map((l, idx): ColumnDef<DataGridFeatures, Row> => ({
      id: l, header: t(`access.${l}`), size: 112, enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <Checkbox
          checked={idx <= r.rank}
          disabled={idx === 0 || set.isPending}
          aria-label={`${r.who} · ${r.owner} · ${t(`access.${l}`)}`}
          // Levels are cumulative: delete implies edit implies view.
          onCheckedChange={(on) => set.mutate({ member_id: r.whoId, target_member_id: r.ownerId, level: on ? l : LEVELS[idx - 1] })}
        />
      ),
      meta: { headerClassName: 'text-center [&>div]:justify-center', cellClassName: 'text-center', skeleton: <Skeleton className="mx-auto size-4" /> },
    })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, i18n.language, set.isPending])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data,
    getRowId: (r: Row) => r.id,
    state: { pagination: { pageIndex: 0, pageSize: 5000 } },
  })
  if (!loading && !failed && data.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('access.title')}</CardTitle>
        <CardDescription>{t('access.hint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DataGrid
          table={table}
          recordCount={data.length}
          isLoading={loading}
          tableLayout={{ dense: true, headerBackground: false, headerSticky: true }}
          emptyMessage={<DataState error onRetry={() => { members.refetch(); access.refetch() }} />}
        >
          <DataGridContainer>
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          </DataGridContainer>
        </DataGrid>
        <FormError message={set.error ? errorMessage(t, set.error) : null} />
      </CardContent>
    </Card>
  )
}
