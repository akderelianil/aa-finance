import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRightIcon, NetworkIcon, PlusIcon, WalletIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { AccountFormDialog, type FormTarget } from '@/components/accounts/AccountFormDialog'
import { AccountTree, type AccountGroup, type AccountNode, type AccountRow, type GroupType } from '@/components/accounts/AccountTree'
import { TransferCards } from '@/components/accounts/TransferCards'
import { PageHeader } from '@/components/PageHeader'
import { FormError } from '@/components/PageShell'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { callFunction } from '@/lib/api'
import { buildTree } from '@/lib/accountTree'
import { errorMessage } from '@/lib/errors'
import { formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'

type Section = 'accounts' | 'expense' | 'income'

export default function Accounts({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const groupId = membership.group.id
  const base = membership.group.base_currency
  const [tab, setTab] = useState<'tree' | 'transfer'>('tree')
  const [form, setForm] = useState<FormTarget | null>(null)
  const [deleting, setDeleting] = useState<AccountNode | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const data = useQuery({
    queryKey: ['accounts', groupId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('accounts')
        .select('id, parent_id, name, type, subtype, currency, owner_member_id, is_placeholder')
        .eq('group_id', groupId).is('system_key', null).is('archived_at', null)
      if (error) throw error
      const { data: bal, error: be } = await supabase
        .from('account_tree_balances').select('account_id, net_amount, net_base_amount')
      if (be) throw be
      const net = new Map(bal.map((b) => [b.account_id as string, { own: Number(b.net_amount), base: Number(b.net_base_amount) }]))
      return { rows: rows as AccountRow[], net }
    },
  })

  const currencies = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('currencies').select('code').order('code')
      if (error) throw error
      return rows.map((r) => r.code as string)
    },
  })

  const trees = useMemo(() => {
    const rows = data.data?.rows ?? []
    const mine = rows.filter((a) => a.owner_member_id === membership.id)
    const of = (src: AccountRow[], type: GroupType) => buildTree(src.filter((a) => a.type === type), i18n.language) as AccountNode[]
    return {
      mine,
      accounts: buildTree(mine.filter((a) => a.type === 'asset' || a.type === 'liability'), i18n.language) as AccountNode[],
      expense: of(rows, 'expense'),
      income: of(rows, 'income'),
      byGroup: {
        asset: of(mine, 'asset'), liability: of(mine, 'liability'), equity: of(mine, 'equity'),
        expense: of(rows, 'expense'), income: of(rows, 'income'),
      } satisfies Record<GroupType, AccountNode[]>,
    }
  }, [data.data, membership.id, i18n.language])

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['accounts', groupId] })
    void queryClient.invalidateQueries({ queryKey: ['categories', groupId] })
  }

  const remove = useMutation({
    mutationFn: (n: AccountNode) => callFunction<{ deleted?: boolean; archived?: boolean }>('account-delete', { account_id: n.id }),
    onSuccess: (res) => {
      setNotice(t(res.archived ? 'accounts.archivedNote' : 'accounts.deleted'))
      setDeleting(null)
      refresh()
    },
  })

  // Bilanço hesabı: kendi para biriminde, borç hesapları pozitif gösterilir. Kategori: ana para biriminde.
  function balance(n: AccountNode) {
    const v = data.data?.net.get(n.id)
    if (!v) return ''
    if (n.type === 'expense') return formatMinor(v.base, base, i18n.language)
    if (n.type === 'income') return formatMinor(-v.base, base, i18n.language)
    return formatMinor(n.type === 'liability' ? -v.own : v.own, n.currency ?? base, i18n.language)
  }

  // Grup toplamı ana para biriminde; bilanço hesabı kendi biriminde gösterildiği için burada ana birime çevrilmiş net kullanılır.
  function groupTotal(type: GroupType) {
    let sum = 0
    for (const n of trees.byGroup[type]) sum += data.data?.net.get(n.id)?.base ?? 0
    return formatMinor(type === 'asset' || type === 'expense' ? sum : -sum, base, i18n.language)
  }
  const groups: AccountGroup[] = (['asset', 'liability', 'equity', 'expense', 'income'] as const).map((type) => ({
    type, nodes: trees.byGroup[type], total: groupTotal(type), canAdd: type !== 'equity',
  }))

  const addRoot = (type: GroupType) => {
    if (type === 'expense' || type === 'income') setForm({ mode: 'create', section: type, parent: null })
    else setForm({ mode: 'create', section: 'accounts', parent: null, subtype: type === 'liability' ? 'credit_card' : 'bank' })
  }
  const sectionOf = (n: AccountNode): Section => (n.type === 'expense' || n.type === 'income' ? n.type : 'accounts')

  return (
    <>
      <PageHeader
        title={t('nav.accounts')}
        description={t('accounts.subtitle')}
        icon={WalletIcon}
        actions={tab === 'tree' && (
          <Button onClick={() => addRoot('asset')}>
            <PlusIcon data-icon="inline-start" />
            {t('accounts.addAccount')}
          </Button>
        )}
      />
      <Tabs value={tab} onValueChange={(v) => { setTab(v as 'tree' | 'transfer'); setNotice(null) }}>
        <TabsList>
          <TabsTrigger value="tree"><NetworkIcon />{t('accounts.tabs.accounts')}</TabsTrigger>
          <TabsTrigger value="transfer"><ArrowLeftRightIcon />{t('accounts.tabs.transfer')}</TabsTrigger>
        </TabsList>
        {data.isLoading ? (
          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            <TabsContent value="tree">
              <Card>
                <CardContent>
                  <AccountTree
                    groups={groups}
                    balance={balance}
                    canEdit={(n) => n.type === 'expense' || n.type === 'income' || n.owner_member_id === membership.id}
                    onAddRoot={addRoot}
                    onAdd={(parent) => setForm({ mode: 'create', section: sectionOf(parent), parent })}
                    onEdit={(node) => setForm({ mode: 'edit', section: sectionOf(node), node })}
                    onDelete={(n) => { setNotice(null); remove.reset(); setDeleting(n) }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="transfer">
              <TransferCards mine={trees.mine} groupId={groupId} currency={base} />
            </TabsContent>
          </>
        )}
      </Tabs>
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      <FormError message={data.error ? errorMessage(t, data.error) : null} />
      <AccountFormDialog
        target={form}
        tree={form ? trees[form.section] : []}
        currencies={currencies.data ?? [base]}
        baseCurrency={base}
        onClose={() => setForm(null)}
        onSaved={refresh}
      />
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('accounts.deleteTitle', { name: deleting?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('accounts.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <FormError message={remove.error ? errorMessage(t, remove.error) : null} />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('entry.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive" disabled={remove.isPending}
              onClick={(e) => { e.preventDefault(); if (deleting) remove.mutate(deleting) }}
            >
              {t('accounts.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
