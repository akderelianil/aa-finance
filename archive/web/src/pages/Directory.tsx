import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeftIcon, ArrowUpRightIcon, BuildingIcon, CopyIcon, MailIcon, PhoneIcon, PlusIcon, TagIcon, UserIcon, XIcon, type LucideIcon } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { AccountPicker } from '@/components/journal/AccountPicker'
import { DataState } from '@/components/DataState'
import { PageHeader } from '@/components/PageHeader'
import { FormError } from '@/components/PageShell'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { useContacts, type Contact, type ContactBank, type ContactKind } from '@/lib/contacts'
import { errorMessage } from '@/lib/errors'
import { flattenTree, formatAmount, useCurrencies, useLedgerAccounts, type AccountNode } from '@/lib/ledger'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Link = { brand_id: string; business_id: string }

const KIND_ICON: Record<ContactKind, LucideIcon> = { individual: UserIcon, brand: TagIcon, business: BuildingIcon }

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toLocaleUpperCase('tr')).join('')

function ContactHint({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`${label}: ${value}`} />}>{icon}</TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  )
}

// Rehber: people, brands and businesses/institutions as cards. Each contact can suggest a default income
// and expense account for Quick Transaction. The open balance comes from receivable/payable lines tagged
// with the contact (whole group, base currency).
export default function Directory({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const base = membership.group.base_currency
  const [filter, setFilter] = useState<ContactKind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Contact | 'new' | null>(null)

  const contacts = useContacts()
  const accounts = useLedgerAccounts()
  const currencies = useCurrencies()
  const baseExp = currencies.data?.find((c) => c.code === base)?.exponent ?? 2
  const byId = accounts.data?.byId ?? new Map<string, AccountNode>()

  const links = useQuery({
    queryKey: ['directory', 'links'],
    queryFn: async () => {
      const { data, error } = await supabase.from('brand_businesses').select('brand_id, business_id')
      if (error) throw error
      return data as Link[]
    },
  })

  const balances = useQuery({
    queryKey: ['ledger', 'contact-balances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('contact_ledger_balances').select('contact_id, net_base_amount')
      if (error) throw error
      return new Map(data.map((r) => [r.contact_id as string, Number(r.net_base_amount)]))
    },
  })

  const active = useMemo(() => (contacts.data ?? []).filter((c) => !c.archived_at), [contacts.data])
  const byContact = new Map(active.map((c) => [c.id, c]))
  const q = search.trim().toLocaleLowerCase(i18n.language)
  const rows = active.filter((c) => (filter === 'all' || c.kind === filter)
    && (!q || [c.name, c.phone, c.email].some((v) => v?.toLocaleLowerCase(i18n.language).includes(q))))

  const accountLabel = (id: string | null) => {
    const a = id ? byId.get(id) : undefined
    return a ? a.name : null
  }
  function linked(c: Contact) {
    if (c.kind === 'individual') return []
    return (links.data ?? [])
      .filter((l) => (c.kind === 'brand' ? l.brand_id : l.business_id) === c.id)
      .map((l) => byContact.get(c.kind === 'brand' ? l.business_id : l.brand_id))
      .filter((x): x is Contact => !!x)
  }

  return (
    <>
      <PageHeader
        title={t('directory.title')} description={t('directory.subtitle')}
        actions={<Button onClick={() => setEditing('new')}><PlusIcon data-icon="inline-start" />{t('directory.add')}</Button>}
      />

      <div className="flex items-center gap-3">
        <Input className="w-72" type="search" placeholder={t('directory.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <ToggleGroup
          value={[filter]} spacing={2} aria-label={t('directory.kind')}
          onValueChange={(v) => { if (v[0]) setFilter(v[0] as ContactKind | 'all') }}
        >
          {(['all', 'individual', 'brand', 'business'] as const).map((k) => (
            <ToggleGroupItem key={k} value={k} variant="outline" size="sm">{t(`directory.kinds.${k}`)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <DataState
        loading={contacts.isLoading}
        error={contacts.isError}
        onRetry={() => { void contacts.refetch() }}
        rows={3}
        empty={contacts.data && rows.length === 0
          ? {
            title: t(active.length === 0 ? 'directory.empty' : 'directory.noMatch'),
            action: active.length === 0
              ? <Button size="sm" onClick={() => setEditing('new')}><PlusIcon data-icon="inline-start" />{t('directory.add')}</Button>
              : undefined,
          }
          : undefined}
      />
      <div className="grid grid-cols-3 gap-4">
        {rows.map((c) => {
          const net = balances.data?.get(c.id) ?? 0
          const related = linked(c)
          const incomeName = accountLabel(c.default_income_account_id)
          const expenseName = accountLabel(c.default_expense_account_id)
          return (
            <Card
              key={c.id} role="button" tabIndex={0}
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() => setEditing(c)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(c) } }}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar size="lg"><AvatarFallback>{initials(c.name)}</AvatarFallback></Avatar>
                  <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle className="truncate">{c.name}</CardTitle>
                    <Badge variant="secondary">
                      {(() => { const K = KIND_ICON[c.kind]; return <K data-icon="inline-start" /> })()}
                      {t(`directory.kinds.${c.kind}`)}
                    </Badge>
                  </div>
                </div>
                <CardAction className="flex gap-1">
                  {c.phone && <ContactHint icon={<PhoneIcon />} label={t('directory.phone')} value={c.phone} />}
                  {c.email && <ContactHint icon={<MailIcon />} label={t('directory.email')} value={c.email} />}
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {related.length > 0 && (
                  <AvatarGroup>
                    {related.slice(0, 5).map((r) => (
                      <Tooltip key={r.id}>
                        <TooltipTrigger render={<Avatar size="sm" />}><AvatarFallback>{initials(r.name)}</AvatarFallback></TooltipTrigger>
                        <TooltipContent>{r.name}</TooltipContent>
                      </Tooltip>
                    ))}
                    {related.length > 5 && <AvatarGroupCount className="size-6 text-xs">+{related.length - 5}</AvatarGroupCount>}
                  </AvatarGroup>
                )}
                {(incomeName || expenseName) && (
                  <div className="flex flex-wrap gap-1">
                    {incomeName && (
                      <Tooltip>
                        <TooltipTrigger render={<Badge variant="outline" />}><ArrowDownLeftIcon data-icon="inline-start" />{incomeName}</TooltipTrigger>
                        <TooltipContent>{t('directory.defaultIncome')}</TooltipContent>
                      </Tooltip>
                    )}
                    {expenseName && (
                      <Tooltip>
                        <TooltipTrigger render={<Badge variant="outline" />}><ArrowUpRightIcon data-icon="inline-start" />{expenseName}</TooltipTrigger>
                        <TooltipContent>{t('directory.defaultExpense')}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </CardContent>
              {net !== 0 && (
                <CardFooter className="justify-between border-t">
                  <Tooltip>
                    <TooltipTrigger render={<span className="text-xs text-muted-foreground" />}>{t('directory.balance')} ({base})</TooltipTrigger>
                    <TooltipContent className="max-w-64">{t('directory.balanceHint')}</TooltipContent>
                  </Tooltip>
                  <span className="flex items-center gap-2 font-mono text-sm tabular-nums">
                    {formatAmount(Math.abs(net), baseExp, i18n.language)}
                    <Badge variant="secondary">{t(net > 0 ? 'directory.debitShort' : 'directory.creditShort')}</Badge>
                  </span>
                </CardFooter>
              )}
            </Card>
          )
        })}
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? t('directory.add') : editing?.name}</DialogTitle>
            <DialogDescription>{t('directory.defaultsHint')}</DialogDescription>
          </DialogHeader>
          {editing !== null && accounts.data && (
            <ContactForm
              key={editing === 'new' ? 'new' : editing.id}
              contact={editing === 'new' ? null : editing} all={active} links={links.data ?? []}
              postable={flattenTree(accounts.data.roots).filter((a) => !a.is_placeholder && !a.archived_at)}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ContactForm({ contact, all, links, postable, onDone }: {
  contact: Contact | null
  all: Contact[]
  links: Link[]
  postable: AccountNode[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState(contact?.name ?? '')
  const [kind, setKind] = useState<ContactKind>(contact?.kind ?? 'individual')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [incomeId, setIncomeId] = useState(contact?.default_income_account_id ?? '')
  const [expenseId, setExpenseId] = useState(contact?.default_expense_account_id ?? '')
  const [banks, setBanks] = useState<ContactBank[]>(contact?.banks ?? [])
  const [linked, setLinked] = useState<string[]>(() => (contact
    ? links.filter((l) => l.brand_id === contact.id || l.business_id === contact.id)
      .map((l) => (l.brand_id === contact.id ? l.business_id : l.brand_id))
    : []))

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['directory'] })
    void queryClient.invalidateQueries({ queryKey: ['contacts'] })
  }

  const save = useMutation({
    mutationFn: () => callFunction('contact-save', {
      id: contact?.id, name: name.trim(), kind,
      phone: kind === 'brand' ? null : phone, email: kind === 'brand' ? null : email,
      default_income_account_id: incomeId || null, default_expense_account_id: expenseId || null,
      links: kind === 'individual' ? [] : linked,
      bank_accounts: kind === 'brand' ? [] : banks.filter((b) => b.iban.trim()),
    }),
    onSuccess: () => { refresh(); onDone() },
  })

  const archive = useMutation({
    mutationFn: () => callFunction('contact-archive', { id: contact!.id }),
    onSuccess: () => { refresh(); onDone() },
  })

  const otherKind: ContactKind | null = kind === 'brand' ? 'business' : kind === 'business' ? 'brand' : null
  const candidates = otherKind ? all.filter((c) => c.kind === otherKind && c.id !== contact?.id) : []
  const pickerCls = 'rounded-3xl bg-input/50 px-1 text-foreground [&_input]:rounded-3xl'

  function copy(iban: string) {
    void navigator.clipboard.writeText(iban).then(() => toast.add({ title: t('directory.copied'), timeout: 2000 }))
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <ToggleGroup
        value={[kind]} spacing={2} className="grid w-full grid-cols-3" aria-label={t('directory.kind')}
        onValueChange={(v) => { if (v[0]) { setKind(v[0] as ContactKind); setLinked([]) } }}
      >
        {(['individual', 'brand', 'business'] as const).map((k) => (
          <ToggleGroupItem key={k} value={k} variant="outline" size="sm">{t(`directory.kinds.${k}`)}</ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Field label={t(kind === 'business' ? 'directory.legalName' : 'directory.name')}>
        <Input required maxLength={100} autoComplete="off" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      {kind !== 'brand' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('directory.phone')}>
            <Input type="tel" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={t('directory.email')}>
            <Input type="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {([['income', incomeId, setIncomeId], ['expense', expenseId, setExpenseId]] as const).map(([type, value, set]) => {
          const label = t(type === 'income' ? 'directory.defaultIncome' : 'directory.defaultExpense')
          return (
            <Field key={type} label={label}>
              <div className="flex items-center gap-1">
                <AccountPicker
                  accounts={postable.filter((a) => a.type === type)} value={value} onChange={set}
                  aria-label={label} className={cn('flex-1', pickerCls)}
                />
                {value && (
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={t('directory.clear')} onClick={() => set('')}><XIcon /></Button>
                )}
              </div>
            </Field>
          )
        })}
      </div>

      {kind !== 'brand' && (
        <Field label={t('directory.banks')}>
          <div className="flex flex-col gap-2">
            {banks.map((b, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label={t('directory.bankName')} placeholder={t('directory.bankName')} className="w-40 shrink-0" maxLength={60}
                  value={b.bank_name ?? ''} onChange={(e) => setBanks(banks.map((x, j) => (j === i ? { ...x, bank_name: e.target.value } : x)))}
                />
                <Input
                  aria-label="IBAN" placeholder="TR.." className="font-mono" maxLength={40} autoComplete="off"
                  value={b.iban} onChange={(e) => setBanks(banks.map((x, j) => (j === i ? { ...x, iban: e.target.value } : x)))}
                />
                {b.iban && (
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={t('directory.copy')} onClick={() => copy(b.iban)}><CopyIcon /></Button>
                )}
                <Button type="button" size="icon-sm" variant="ghost" aria-label={t('gj.removeLine')} onClick={() => setBanks(banks.filter((_, j) => j !== i))}>
                  <XIcon />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setBanks([...banks, { bank_name: '', iban: '' }])}>
              <PlusIcon data-icon="inline-start" />{t('directory.addIban')}
            </Button>
          </div>
        </Field>
      )}

      {otherKind && (
        <Field label={t(kind === 'brand' ? 'directory.businesses' : 'directory.brands')}>
          {candidates.length === 0
            ? <span>{t('directory.noCandidates')}</span>
            : (
              <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto text-sm text-foreground">
                {candidates.map((c) => (
                  <label key={c.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={linked.includes(c.id)}
                      onCheckedChange={(on) => setLinked(on ? [...linked, c.id] : linked.filter((x) => x !== c.id))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
        </Field>
      )}

      <div className="flex items-center gap-3">
        <FormError message={save.error ? errorMessage(t, save.error) : archive.error ? errorMessage(t, archive.error) : null} />
        {contact && (
          <Button type="button" variant="ghost" className="text-destructive" disabled={archive.isPending} onClick={() => archive.mutate()}>
            {t('directory.archive')}
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>{t('ledger.cancel')}</Button>
          <Button type="submit" disabled={save.isPending || !name.trim()}>{t('ledger.save')}</Button>
        </div>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </div>
  )
}
