import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CopyIcon, PlusIcon, XIcon } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { AccountPicker } from '@/components/journal/AccountPicker'
import { PageHeader } from '@/components/PageHeader'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { useContacts, type Contact, type ContactBank, type ContactKind } from '@/lib/contacts'
import { errorMessage } from '@/lib/errors'
import { flattenTree, formatAmount, useCurrencies, useLedgerAccounts, type AccountNode } from '@/lib/ledger'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Link = { brand_id: string; business_id: string }

// Rehber: people, brands and businesses/institutions in one table. Each contact can suggest a default income
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
  const nameOf = new Map(active.map((c) => [c.id, c.name]))
  const q = search.trim().toLocaleLowerCase(i18n.language)
  const rows = active.filter((c) => (filter === 'all' || c.kind === filter)
    && (!q || [c.name, c.phone, c.email].some((v) => v?.toLocaleLowerCase(i18n.language).includes(q))))

  const accountLabel = (id: string | null) => {
    const a = id ? byId.get(id) : undefined
    return a ? a.name : null
  }
  function linked(c: Contact) {
    if (c.kind === 'individual') return ''
    return (links.data ?? [])
      .filter((l) => (c.kind === 'brand' ? l.brand_id : l.business_id) === c.id)
      .map((l) => nameOf.get(c.kind === 'brand' ? l.business_id : l.brand_id))
      .filter(Boolean).join(', ')
  }

  return (
    <>
      <PageHeader
        title={t('directory.title')} description={t('directory.subtitle')}
        actions={<Button onClick={() => setEditing('new')}><PlusIcon data-icon="inline-start" />{t('directory.add')}</Button>}
      />

      <div className="flex items-center gap-3">
        <Input className="h-8 w-72" type="search" placeholder={t('directory.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <ToggleGroup
          value={[filter]} spacing={2} aria-label={t('directory.kind')}
          onValueChange={(v) => { if (v[0]) setFilter(v[0] as ContactKind | 'all') }}
        >
          {(['all', 'individual', 'brand', 'business'] as const).map((k) => (
            <ToggleGroupItem key={k} value={k} variant="outline" size="sm">{t(`directory.kinds.${k}`)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th>{t('directory.name')}</th>
              <th className="w-28">{t('directory.kind')}</th>
              <th>{t('directory.phone')} · {t('directory.email')}</th>
              <th>{t('directory.defaultIncome')}</th>
              <th>{t('directory.defaultExpense')}</th>
              <th className="w-44 !text-right" title={t('directory.balanceHint')}>{t('directory.balance')} ({base})</th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-t [&>tr>td]:px-3 [&>tr>td]:py-1.5">
            {contacts.isLoading && <tr><td colSpan={6} className="text-center text-muted-foreground">{t('ledger.loading')}</td></tr>}
            {contacts.data && rows.length === 0 && <tr><td colSpan={6} className="text-center text-muted-foreground">{t('directory.empty')}</td></tr>}
            {rows.map((c) => {
              const net = balances.data?.get(c.id) ?? 0
              const sub = linked(c)
              return (
                <tr key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setEditing(c)}>
                  <td>
                    <span className="font-medium">{c.name}</span>
                    {sub && <span className="ml-2 text-xs text-muted-foreground">{sub}</span>}
                  </td>
                  <td className="text-muted-foreground">{t(`directory.kinds.${c.kind}`)}</td>
                  <td className="text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(' · ')}</td>
                  <td>{accountLabel(c.default_income_account_id)}</td>
                  <td>{accountLabel(c.default_expense_account_id)}</td>
                  <td className="text-right font-mono tabular-nums">
                    {net !== 0 && <>
                      {formatAmount(Math.abs(net), baseExp, i18n.language)}
                      <span className="ml-1 text-xs text-muted-foreground">{t(net > 0 ? 'directory.debitShort' : 'directory.creditShort')}</span>
                    </>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <FormError message={contacts.error ? errorMessage(t, contacts.error) : null} />

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
        <Input className="h-8" required maxLength={100} autoComplete="off" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      {kind !== 'brand' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('directory.phone')}>
            <Input className="h-8" type="tel" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={t('directory.email')}>
            <Input className="h-8" type="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} />
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
                  aria-label={t('directory.bankName')} placeholder={t('directory.bankName')} className="h-8 w-40 shrink-0" maxLength={60}
                  value={b.bank_name ?? ''} onChange={(e) => setBanks(banks.map((x, j) => (j === i ? { ...x, bank_name: e.target.value } : x)))}
                />
                <Input
                  aria-label="IBAN" placeholder="TR.." className="h-8 font-mono" maxLength={40} autoComplete="off"
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
