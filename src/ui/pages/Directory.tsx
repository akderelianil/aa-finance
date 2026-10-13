import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ContactDialog, type ContactTarget } from '@/components/directory/ContactDialog'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/reui/alert'
import { Frame, FramePanel } from '@/components/reui/frame'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

  const open = (kind: 'receivable' | 'payable') => (balances.data ?? []).filter((b) => b.kind === kind)
  const totals = useMemo(() => (['receivable', 'payable'] as const).map((kind) => {
    const sums = new Map<string, number>()
    for (const b of balances.data ?? []) if (b.kind === kind) sums.set(b.currency, (sums.get(b.currency) ?? 0) + b.amount)
    return { kind, sums: [...sums] }
  }), [balances.data])
  const add = <Button onClick={() => setTarget({ mode: 'create' })}><PlusIcon data-icon="inline-start" />{t('dir.add')}</Button>
  const filtered = !!contacts.data?.length
  const hasOpen = open('receivable').length + open('payable').length > 0

  return (
    <>
      <PageHeader title={t('nav.directory')} description={t('dir.subtitle')} actions={add} />
      <Frame spacing="sm" stacked>
        {hasOpen && (
          <FramePanel className="grid grid-cols-2 gap-4">
            {totals.map(({ kind, sums }) => (
              <div key={kind} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{t(`dir.total.${kind}`)}</span>
                {sums.length ? sums.map(([cur, amount]) => (
                  <span key={cur} className="text-lg font-semibold tabular-nums">{fmt(amount, cur)} {cur}</span>
                )) : <span className="text-lg text-muted-foreground">–</span>}
              </div>
            ))}
          </FramePanel>
        )}
        <FramePanel className="flex items-center gap-3 p-2">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>{FILTERS.map((f) => <TabsTrigger key={f} value={f}>{t(`dir.kind.${f}`)}</TabsTrigger>)}</TabsList>
          </Tabs>
          <Input className="w-64" value={search} placeholder={t('dir.search')} aria-label={t('dir.search')} onChange={(e) => setSearch(e.target.value)} />
        </FramePanel>
        <FramePanel className="p-0">
          {contacts.isPending ? (
            <div className="flex flex-col divide-y">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex flex-col gap-1.5"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
                </div>
              ))}
            </div>
          ) : contacts.isError ? (
            <Empty>
              <EmptyHeader><EmptyTitle>{t('state.error')}</EmptyTitle></EmptyHeader>
              <Button variant="outline" size="sm" onClick={() => contacts.refetch()}>{t('state.retry')}</Button>
            </Empty>
          ) : rows.length === 0 ? (
            filtered ? (
              <Empty><EmptyHeader><EmptyTitle>{t('dir.emptyFilter')}</EmptyTitle></EmptyHeader></Empty>
            ) : (
              <Empty>
                <EmptyHeader><EmptyTitle>{t('dir.empty')}</EmptyTitle><EmptyDescription>{t('dir.emptyHint')}</EmptyDescription></EmptyHeader>
                {add}
              </Empty>
            )
          ) : (
            <ul className="flex flex-col divide-y">
              {rows.map((c) => {
                const mine = (balances.data ?? []).filter((b) => b.contact === c.id)
                const links = c.partners.map((id) => names.get(id)).filter(Boolean).join(', ')
                return (
                  <li key={c.id} className="flex items-center gap-1 pe-2">
                    <button
                      type="button" onClick={() => setTarget({ mode: 'edit', contact: c })} aria-label={`${t('dir.edit')}: ${c.name}`}
                      className="flex min-w-0 flex-1 items-center gap-3 p-3 text-start transition-colors hover:bg-muted/50"
                    >
                      <Avatar><AvatarFallback>{c.name.trim().slice(0, 1).toLocaleUpperCase(i18n.language)}</AvatarFallback></Avatar>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{[t(`dir.kind.${c.kind}`), links].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="flex flex-col items-end text-sm tabular-nums">
                        {mine.length ? mine.map((b) => (
                          <span key={b.kind + b.currency}>
                            <span className="me-2 text-xs text-muted-foreground">{t(`dir.${b.kind}`)}</span>
                            <span className="font-medium">{fmt(b.amount, b.currency)} {b.currency}</span>
                          </span>
                        )) : <span className="text-xs text-muted-foreground">{t('dir.settled')}</span>}
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('common.actions')} />}>
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onClick={() => setTarget({ mode: 'edit', contact: c })}><PencilIcon />{t('dir.editShort')}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => { remove.reset(); setDeleting(c) }}><Trash2Icon />{t('common.delete')}</DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                )
              })}
            </ul>
          )}
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
