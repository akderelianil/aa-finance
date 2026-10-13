import { useTable, type ColumnDef } from '@tanstack/react-table'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { OptionCombobox } from '@/components/OptionCombobox'
import { OptionSelect } from '@/components/OptionSelect'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/reui/alert'
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { parseDecimal, today } from '@/lib/amount'
import { useErrorText, useOp, useWrite } from '@/lib/api'
import { useFormat } from '@/lib/format'
import { useBook } from '@/lib/ledger'
import type { FxRate } from '../../core/api/fx.ts'

// Exchange rates (Kurlar): manual rates per currency and date. 1 unit = rate units of the base currency.
// An entry uses the latest rate on or before its date. Few rows: no paging.
export default function Rates() {
  const { t, i18n } = useTranslation()
  const errorText = useErrorText()
  const { base } = useBook()
  const { date: fmtDate } = useFormat()
  const [currency, setCurrency] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<FxRate | null>(null)
  const rates = useOp('fx.list', { currency: currency || undefined })
  const accounts = useOp('accounts.list', {})
  const remove = useWrite('fx.delete')
  // Currencies the book uses first: those of its accounts.
  const used = [...new Set((accounts.data ?? []).map((a) => a.currency).filter((c) => c !== base))].sort()

  const columns = useMemo<ColumnDef<DataGridFeatures, FxRate>[]>(() => [
    {
      id: 'currency', accessorFn: (r) => r.currency, size: 120,
      header: ({ column }) => <DataGridColumnHeader title={t('fx.currency')} column={column} />,
      cell: ({ row: { original: r } }) => <span className="font-medium">{r.currency}</span>,
      meta: { skeleton: <Skeleton className="h-4 w-12" /> },
    },
    {
      id: 'date', accessorFn: (r) => r.date, size: 160,
      header: ({ column }) => <DataGridColumnHeader title={t('gj.date')} column={column} />,
      cell: ({ row: { original: r } }) => (
        <span className="tabular-nums">{fmtDate(r.date)}</span>
      ),
      meta: { skeleton: <Skeleton className="h-4 w-20" /> },
    },
    {
      id: 'rate', accessorFn: (r) => r.rate, size: 200, enableSorting: false,
      header: ({ column }) => <DataGridColumnHeader title={t('fx.rate', { base })} column={column} />,
      cell: ({ row: { original: r } }) => r.rate,
      meta: { headerClassName: 'text-end [&>div]:justify-end', cellClassName: 'text-end tabular-nums', skeleton: <Skeleton className="ml-auto h-4 w-16" /> },
    },
    {
      id: 'actions', header: () => null, size: 56, enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <Button
          variant="ghost" size="icon-xs" aria-label={t('common.delete')}
          onClick={() => { remove.reset(); setDeleting(r) }}
        >
          <Trash2Icon />
        </Button>
      ),
      meta: { skeleton: <Skeleton className="size-5" /> },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, i18n.language, base, fmtDate])

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rates.data ?? [],
    getRowId: (r: FxRate) => String(r.id),
    state: { pagination: { pageIndex: 0, pageSize: rates.isPending ? 10 : 10_000 } },
  })
  const add = <Button onClick={() => setAdding(true)}><PlusIcon data-icon="inline-start" />{t('fx.add')}</Button>

  return (
    <>
      <PageHeader title={t('nav.rates')} description={t('fx.subtitle', { base })} actions={add} />
      <Frame spacing="sm" stacked>
        <FramePanel className="flex items-center gap-2 p-2">
          <OptionSelect
            className="w-48" label={t('fx.currency')} value={currency} onChange={setCurrency} placeholder={t('fx.allCurrencies')}
            options={used.map((c) => ({ value: c, label: c }))}
          />
        </FramePanel>
        <FramePanel className="p-0">
          <DataGrid
            table={table}
            recordCount={rates.data?.length ?? 0}
            isLoading={rates.isPending}
            tableLayout={{ dense: true, headerBackground: false }}
            emptyMessage={rates.isError ? (
              <Empty>
                <EmptyHeader><EmptyTitle>{t('state.error')}</EmptyTitle></EmptyHeader>
                <Button variant="outline" size="sm" onClick={() => rates.refetch()}>{t('state.retry')}</Button>
              </Empty>
            ) : (
              <Empty>
                <EmptyHeader><EmptyTitle>{t('fx.empty')}</EmptyTitle><EmptyDescription>{t('fx.emptyHint')}</EmptyDescription></EmptyHeader>
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
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fx.deleteTitle', { currency: deleting?.currency ?? '', date: deleting ? fmtDate(deleting.date) : '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('fx.deleteBody')}</AlertDialogDescription>
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
      <RateDialog open={adding} onClose={() => setAdding(false)} base={base} first={currency || used[0] || ''} />
    </>
  )
}

function RateDialog({ open, onClose, base, first }: { open: boolean; onClose: () => void; base: string; first: string }) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('fx.add')}</DialogTitle>
          <DialogDescription>{t('fx.addHint', { base })}</DialogDescription>
        </DialogHeader>
        {open && <RateForm onClose={onClose} base={base} first={first} />}
      </DialogContent>
    </Dialog>
  )
}

function RateForm({ onClose, base, first }: { onClose: () => void; base: string; first: string }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const { currencies } = useBook()
  const [currency, setCurrency] = useState(first)
  const [date, setDate] = useState(today())
  const [rate, setRate] = useState('')
  const [attempted, setAttempted] = useState(false)
  const set = useWrite('fx.set')
  const parsed = parseDecimal(rate, 12)
  const rateError = !parsed || !/[1-9]/.test(parsed) ? t('fx.rateInvalid') : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (rateError || !currency || !date) { setAttempted(true); return }
    // Saving a currency and date that already have a rate replaces it.
    set.mutate({ currency, date, rate: parsed! }, { onSuccess: onClose })
  }

  return (
    <form onSubmit={onSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) e.currentTarget.requestSubmit() }}>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="fx-currency">{t('fx.currency')}</FieldLabel>
            <OptionCombobox
              id="fx-currency" value={currency} onChange={setCurrency} placeholder={t('fx.pickCurrency')}
              options={currencies.filter((c) => c.code !== base).map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="fx-date">{t('gj.date')}</FieldLabel>
            <Input id="fx-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="fx-rate">{t('fx.rate', { base })}</FieldLabel>
          <Input
            id="fx-rate" inputMode="decimal" autoFocus className="text-end tabular-nums" value={rate}
            aria-invalid={(attempted && !!rateError) || undefined}
            onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ''))}
          />
          {attempted && rateError
            ? <FieldDescription className="text-destructive">{rateError}</FieldDescription>
            : <FieldDescription>{currency ? t('fx.example', { currency, base }) : null}</FieldDescription>}
        </Field>
        {set.error && <Alert variant="destructive" role="alert"><AlertDescription>{errorText(set.error)}</AlertDescription></Alert>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={set.isPending}>{t('common.save')}</Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}
