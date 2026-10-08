import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDownIcon, ChevronRightIcon, ChevronsDownUpIcon, ChevronsUpDownIcon, ListTreeIcon, MoreHorizontalIcon, PlusIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { AccountDialog, type AccountTarget } from '@/components/coa/AccountDialog'
import { PageHeader } from '@/components/PageHeader'
import { FormError } from '@/components/PageShell'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import {
  flattenTree, formatAmount, shown, useCurrencies, useLedgerAccounts, useMembers, type AccountNode,
} from '@/lib/ledger'
import { cn } from '@/lib/utils'

// Chart of Accounts (GnuCash "Accounts" tab): code-ordered tree with own balance and subtree total.
export default function Accounts({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const base = membership.group.base_currency
  const accounts = useLedgerAccounts()
  const members = useMembers()
  const currencies = useCurrencies()
  const exp = new Map((currencies.data ?? []).map((c) => [c.code, c.exponent]))
  const fmt = (minor: number, cur: string) => formatAmount(minor, exp.get(cur) ?? 2, i18n.language)

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [target, setTarget] = useState<AccountTarget | null>(null)
  const [deleting, setDeleting] = useState<AccountNode | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ledger'] })
  const memberName = new Map((members.data ?? []).map((m) => [m.id, m.name]))

  // Visible roots: archived nodes only on request; a search keeps matches and their ancestors.
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase(i18n.language)
    const keep = (n: AccountNode): AccountNode | null => {
      if (n.archived_at && !showArchived) return null
      const children = n.children.map(keep).filter((c): c is AccountNode => !!c)
      const hit = !q || n.code.startsWith(q) || n.name.toLocaleLowerCase(i18n.language).includes(q)
      return hit || children.length ? { ...n, children } : null
    }
    return (accounts.data?.roots ?? []).map(keep).filter((n): n is AccountNode => !!n)
  }, [accounts.data, search, showArchived, i18n.language])

  const rows = useMemo(() => {
    const out: AccountNode[] = []
    const walk = (nodes: AccountNode[]) => {
      for (const n of nodes) {
        out.push(n)
        if (!collapsed.has(n.id) || search) walk(n.children)
      }
    }
    walk(visible)
    return out
  }, [visible, collapsed, search])

  const toggle = (id: string) => setCollapsed((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const archive = useMutation({
    mutationFn: (n: AccountNode) => callFunction('account-update', { account_id: n.id, archived: !n.archived_at }),
    onSuccess: refresh,
    onError: (e) => toast.add({ title: errorMessage(t, e), timeout: 4000 }),
  })
  const remove = useMutation({
    mutationFn: (n: AccountNode) => callFunction<{ deleted?: boolean; archived?: boolean }>('account-delete', { account_id: n.id }),
    onSuccess: (r) => {
      toast.add({ title: r.archived ? t('coa.archivedNote') : t('coa.deleted'), timeout: 3000 })
      setDeleting(null)
      refresh()
    },
  })

  return (
    <>
      <PageHeader
        title={t('coa.title')} description={t('coa.subtitle')} icon={ListTreeIcon}
        actions={<Button onClick={() => setTarget({ mode: 'create', parent: null })}><PlusIcon data-icon="inline-start" />{t('coa.add')}</Button>}
      />
      <div className="flex items-center gap-3">
        <Input className="w-72" placeholder={t('coa.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>
          <ChevronsUpDownIcon data-icon="inline-start" />{t('coa.expandAll')}
        </Button>
        <Button
          variant="outline" size="sm"
          onClick={() => setCollapsed(new Set(flattenTree(accounts.data?.roots ?? []).filter((n) => n.children.length).map((n) => n.id)))}
        >
          <ChevronsDownUpIcon data-icon="inline-start" />{t('coa.collapseAll')}
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
          {t('coa.showArchived')}
        </label>
      </div>

      <div className="rounded-xl border">
        <Table className="text-sm [&_td]:py-1.5 [&_th]:h-9">
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">{t('ledger.code')}</TableHead>
              <TableHead>{t('ledger.name')}</TableHead>
              <TableHead className="w-36">{t('coa.kind')}</TableHead>
              <TableHead className="w-20">{t('ledger.currency')}</TableHead>
              <TableHead className="w-36">{t('ledger.owner')}</TableHead>
              <TableHead className="w-40 text-right">{t('ledger.balance')}</TableHead>
              <TableHead className="w-40 text-right">{t('ledger.total', { currency: base })}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t('ledger.loading')}</TableCell></TableRow>
            )}
            {!accounts.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t('coa.empty')}</TableCell></TableRow>
            )}
            {rows.map((n) => {
              const top = n.depth === 0
              const own = shown(n.type, n.net)
              const total = shown(n.type, n.treeNetBase)
              return (
                <TableRow
                  key={n.id}
                  className={cn('cursor-default select-none', top && 'bg-muted/40 font-semibold', n.archived_at && 'text-muted-foreground')}
                  onDoubleClick={() => !n.is_placeholder && navigate(`/hesaplar/${n.id}`)}
                >
                  <TableCell className="font-mono tabular-nums">{n.code}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" style={{ paddingLeft: `${n.depth * 1.25}rem` }}>
                      {n.children.length > 0 ? (
                        <button
                          type="button" className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                          aria-label={n.name} onClick={() => toggle(n.id)}
                        >
                          {collapsed.has(n.id) && !search ? <ChevronRightIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                        </button>
                      ) : <span className="w-5" />}
                      <span className={cn(n.is_placeholder && 'italic')}>{n.name}</span>
                      {n.system_key && <Badge variant="outline" className="ml-2">{t('coa.system')}</Badge>}
                      {n.archived_at && <Badge variant="secondary" className="ml-2">{t('coa.archived')}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {n.is_placeholder ? t('coa.placeholder') : n.subtype ? t(`ledger.subtype.${n.subtype}`) : t(`ledger.type.${n.type}`)}
                  </TableCell>
                  <TableCell className="font-mono">{n.currency}</TableCell>
                  <TableCell className="text-muted-foreground">{n.owner_member_id ? memberName.get(n.owner_member_id) : ''}</TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', own < 0 && 'text-destructive')}>
                    {n.is_placeholder ? '' : fmt(own, n.currency)}
                  </TableCell>
                  <TableCell className={cn('text-right font-mono tabular-nums', total < 0 && 'text-destructive')}>
                    {fmt(total, base)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('ledger.actions')} />}>
                        <MoreHorizontalIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          {!n.is_placeholder && (
                            <DropdownMenuItem onClick={() => navigate(`/hesaplar/${n.id}`)}>{t('coa.openRegister')}</DropdownMenuItem>
                          )}
                          {!n.system_key && (
                            <DropdownMenuItem onClick={() => setTarget({ mode: 'create', parent: n })}>{t('coa.addChild')}</DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setTarget({ mode: 'edit', node: n })}>{t('ledger.edit')}</DropdownMenuItem>
                        </DropdownMenuGroup>
                        {!n.system_key && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuItem onClick={() => archive.mutate(n)}>
                                {n.archived_at ? t('coa.unarchive') : t('coa.archive')}
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleting(n)}>{t('ledger.delete')}</DropdownMenuItem>
                            </DropdownMenuGroup>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <AccountDialog
        target={target}
        roots={accounts.data?.roots ?? []}
        members={members.data ?? []}
        currencies={(currencies.data ?? []).map((c) => c.code)}
        baseCurrency={base}
        onClose={() => setTarget(null)}
        onSaved={refresh}
      />
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('coa.deleteTitle', { name: deleting ? `${deleting.code} ${deleting.name}` : '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('coa.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <FormError message={remove.error ? errorMessage(t, remove.error) : null} />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('ledger.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive" disabled={remove.isPending}
              onClick={(e) => { e.preventDefault(); if (deleting) remove.mutate(deleting) }}
            >
              {t('ledger.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
