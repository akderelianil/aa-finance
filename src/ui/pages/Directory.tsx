import { useTable, type ColumnDef } from '@tanstack/react-table'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ContactDialog, type ContactTarget } from '@/components/directory/ContactDialog'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Badge } from '@/components/reui/badge'
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { Frame, FramePanel } from '@/components/reui/frame'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useErrorText, useOp, useWrite } from '@/lib/api'
import { useBook } from '@/lib/ledger'
import type { Contact, ContactKind } from '../../core/api/contacts.ts'

type Filter = 'all' | ContactKind
const FILTERS: Filter[] = ['all', 'individual', 'brand', 'business']

// Rehber (Directory): the people, brands and businesses debts are with. A Brand links to Businesses and back.
// Few rows: no paging, the filter and search run in the browser.
export default function Directory() {
  const { t, i18n } = useTranslation()
  const errorText = useErrorText()
  const contacts = useOp('contacts.list', {})
  const balances = useOp('contacts.balances', {})
  const { fmt } = useBook()
  const remove = useWrite('contacts.delete')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<ContactTarget | null>(null)
  const [deleting, setDeleting] = useState<Contact | null>(null)

  const names = useMemo(() => new Map((contacts.data ?? []).map((c) => [c.id, c.name])), [contacts.data])
  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(i18n.language)
    return (contacts.data ?? []).filter((c) => (filter === 'all' || c.kind === filter) && (!q || c.name.toLocaleLowerCase(i18n.language).includes(q)))
  }, [contacts.data, filter, search, i18n.language])

  const columns = useMemo<ColumnDef<DataGridFeatures, Contact>[]>(() => [
    {
      id: 'name', accessorFn: (c) => c.name,
      header: ({ column }) => <DataGridColumnHeader title={t('dir.name')} column={column} />,
      cell: ({ row: { original: c } }) => <span className="font-medium">{c.name}</span>,
      meta: { skeleton: <Skeleton className="h-4 w-40" /> },
    },
    {
      id: 'kind', accessorFn: (c) => c.kind, size: 140,
      header: ({ column }) => <DataGridColumnHeader title={t('dir.kindLabel')} column={column} />,
      cell: ({ row: { original: c } }) => <Badge variant={c.kind === 'individual' ? 'secondary' : 'primary-light'}>{t(`dir.kind.${c.kind}`)}</Badge>,
      meta: { skeleton: <Skeleton className="h-5 w-16" /> },
    },
    {
      id: 'links', header: t('dir.links'), enableSorting: false,
      cell: ({ row: { original: c } }) => (
        <span className="text-muted-foreground">{c.partners.map((id) => names.get(id)).filter(Boolean).join(', ') || (c.kind === 'individual' ? '' : t('dir.noLinks'))}</span>
      ),
      meta: { skeleton: <Skeleton className="h-4 w-48" /> },
    },
    ...(['receivable', 'payable'] as const).map((kind): ColumnDef<DataGridFeatures, Contact> => ({
      id: kind, header: t(`dir.${kind}`), size: 170, enableSorting: false,
      cell: ({ row: { original: c } }) => {
        const mine = (balances.data ?? []).filter((b) => b.contact === c.id && b.kind === kind)
        return mine.length
          ? <div className="flex flex-col">{mine.map((b) => <span key={b.currency}>{fmt(b.amount, b.currency)} {b.currency}</span>)}</div>
          : <span className="text-muted-foreground">–</span>
      },
      meta: { headerClassName: 'text-end', cellClassName: 'text-end tabular-nums', skeleton: <Skeleton className="ml-auto h-4 w-20" /> },
    })),
    {
      id: 'actions', header: () => null, size: 80, enableSorting: false,
      cell: ({ row: { original: c } }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-xs" aria-label={t('dir.edit')} onClick={() => setTarget({ mode: 'edit', contact: c })}><PencilIcon /></Button>
          <Button variant="ghost" size="icon-xs" aria-label={t('common.delete')} onClick={() => { remove.reset(); setDeleting(c) }}><Trash2Icon /></Button>
        </div>
      ),
      meta: { skeleton: <Skeleton className="ml-auto size-5" /> },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, i18n.language, names, balances.data, fmt])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    getRowId: (c: Contact) => String(c.id),
    state: { pagination: { pageIndex: 0, pageSize: contacts.isPending ? 10 : 10_000 } },
  })
  const add = <Button onClick={() => setTarget({ mode: 'create' })}><PlusIcon data-icon="inline-start" />{t('dir.add')}</Button>
  const filtered = !!contacts.data?.length

  return (
    <>
      <PageHeader title={t('nav.directory')} description={t('dir.subtitle')} actions={add} />
      <Frame spacing="sm" stacked>
        <FramePanel className="flex items-center gap-3 p-2">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>{FILTERS.map((f) => <TabsTrigger key={f} value={f}>{t(`dir.kind.${f}`)}</TabsTrigger>)}</TabsList>
          </Tabs>
          <Input className="w-64" value={search} placeholder={t('dir.search')} aria-label={t('dir.search')} onChange={(e) => setSearch(e.target.value)} />
        </FramePanel>
        <FramePanel className="p-0">
          <DataGrid
            table={table}
            recordCount={rows.length}
            isLoading={contacts.isPending}
            tableLayout={{ dense: true, headerBackground: false }}
            emptyMessage={contacts.isError ? (
              <Empty>
                <EmptyHeader><EmptyTitle>{t('state.error')}</EmptyTitle></EmptyHeader>
                <Button variant="outline" size="sm" onClick={() => contacts.refetch()}>{t('state.retry')}</Button>
              </Empty>
            ) : filtered ? (
              <Empty><EmptyHeader><EmptyTitle>{t('dir.emptyFilter')}</EmptyTitle></EmptyHeader></Empty>
            ) : (
              <Empty>
                <EmptyHeader><EmptyTitle>{t('dir.empty')}</EmptyTitle><EmptyDescription>{t('dir.emptyHint')}</EmptyDescription></EmptyHeader>
                {add}
              </Empty>
            )}
          >
            <DataGridContainer>
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
          </DataGrid>
        </FramePanel>
      </Frame>
      <ContactDialog target={target} contacts={contacts.data ?? []} onClose={() => setTarget(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dir.deleteTitle', { name: deleting?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('dir.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          {remove.error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(remove.error)}</AlertDescription></Alert>}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive" disabled={remove.isPending}
              onClick={(ev) => { ev.preventDefault(); if (deleting) remove.mutate({ id: deleting.id }, { onSuccess: () => setDeleting(null) }) }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
