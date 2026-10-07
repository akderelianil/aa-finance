import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CopyIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { OptionSelect } from '@/components/OptionSelect'
import { FormError, PageShell } from '@/components/PageShell'
import { ResponsiveDialog } from '@/components/ResponsiveDialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { callFunction } from '@/lib/api'
import { initials } from '@/lib/avatar'
import { errorMessage } from '@/lib/errors'
import { formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Kind = 'individual' | 'brand' | 'business'
type Bank = { bank_name: string | null; iban: string }
type Contact = {
  id: string
  name: string
  kind: Kind
  phone: string | null
  email: string | null
  tax_id: string | null
  default_category_id: string | null
  default_category: { name: string } | null
  banks: Bank[]
}
type Link = { brand_id: string; business_id: string }

// Rehber: kişi · marka · firma tek listede, türe göre süzülür. Kişide borç/alacak bakiyesi görünür.
export default function Directory({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const groupId = membership.group.id
  const currency = membership.group.base_currency
  const [filter, setFilter] = useState<Kind | 'all'>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Contact | 'new' | null>(null)

  const contacts = useQuery({
    queryKey: ['directory', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, kind, phone, email, tax_id, default_category_id, default_category:accounts(name), banks:contact_bank_accounts(bank_name, iban)')
        .eq('group_id', groupId).is('archived_at', null).order('name')
        .overrideTypes<Contact[]>()
      if (error) throw error
      return data
    },
  })

  const links = useQuery({
    queryKey: ['brand-businesses', groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from('brand_businesses').select('brand_id, business_id').eq('group_id', groupId)
      if (error) throw error
      return data as Link[]
    },
  })

  // Kişi id → net (minor): + bana borçlu, − ben borçluyum (yalnız benim hesaplarım).
  const balances = useQuery({
    queryKey: ['contact-balances', membership.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_balances').select('contact_id, net_base_amount').eq('member_id', membership.id)
      if (error) throw error
      const m = new Map<string, number>()
      for (const r of data) m.set(r.contact_id, (m.get(r.contact_id) ?? 0) + Number(r.net_base_amount))
      return m
    },
  })

  const q = search.trim().toLocaleLowerCase(i18n.language)
  const rows = (contacts.data ?? []).filter((c) =>
    (filter === 'all' || c.kind === filter) && (!q || c.name.toLocaleLowerCase(i18n.language).includes(q)))
  const nameOf = new Map((contacts.data ?? []).map((c) => [c.id, c.name]))

  function subtitle(c: Contact) {
    if (c.kind === 'brand') {
      const firms = (links.data ?? []).filter((l) => l.brand_id === c.id).map((l) => nameOf.get(l.business_id))
      return [c.default_category?.name, firms.length ? firms.join(', ') : null].filter(Boolean).join(' · ')
    }
    if (c.kind === 'business') {
      const brands = (links.data ?? []).filter((l) => l.business_id === c.id).map((l) => nameOf.get(l.brand_id))
      return brands.join(', ')
    }
    return c.phone ?? ''
  }

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('directory.title')}</h1>
        <Button onClick={() => setEditing('new')}><PlusIcon data-icon="inline-start" />{t('directory.add')}</Button>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <InputGroup>
            <InputGroupAddon><SearchIcon /></InputGroupAddon>
            <InputGroupInput
              type="search" value={search} placeholder={t('directory.search')} aria-label={t('directory.search')}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputGroup>
          <ToggleGroup
            value={[filter]} spacing={2} aria-label={t('directory.filter')}
            onValueChange={(v) => { if (v[0]) setFilter(v[0] as Kind | 'all') }}
          >
            {(['all', 'individual', 'brand', 'business'] as const).map((k) => (
              <ToggleGroupItem key={k} value={k} variant="outline" size="sm">{t(`directory.kinds.${k}`)}</ToggleGroupItem>
            ))}
          </ToggleGroup>
          {contacts.isLoading && <div className="flex flex-col gap-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>}
          {contacts.data && rows.length === 0 && (
            <Empty><EmptyHeader><EmptyTitle>{t('directory.empty')}</EmptyTitle>
              <EmptyDescription>{t('directory.emptyHint')}</EmptyDescription>
            </EmptyHeader></Empty>
          )}
          <ul className="flex flex-col divide-y">
            {rows.map((c) => {
              const net = c.kind === 'individual' ? balances.data?.get(c.id) ?? 0 : 0
              return (
                <li key={c.id}>
                  <button type="button" className="flex w-full items-center gap-3 py-2 text-left" onClick={() => setEditing(c)}>
                    <Avatar className="size-9"><AvatarFallback>{initials(c.name)}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{c.name}</span>
                        <Badge variant="secondary">{t(`directory.kinds.${c.kind}`)}</Badge>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{subtitle(c)}</span>
                    </span>
                    {net !== 0 && (
                      <span className={cn('shrink-0 text-right text-xs', net > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
                        {t(net > 0 ? 'entry.debt.theyOwe' : 'entry.debt.iOwe', { amount: formatMinor(Math.abs(net), currency, i18n.language) })}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          <FormError message={contacts.error ? errorMessage(t, contacts.error) : null} />
        </CardContent>
      </Card>
      <ResponsiveDialog
        open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null) }}
        title={t(editing === 'new' ? 'directory.add' : 'directory.edit')}
      >
        {editing !== null && (
          <ContactForm
            key={editing === 'new' ? 'new' : editing.id} groupId={groupId}
            contact={editing === 'new' ? null : editing} all={contacts.data ?? []} links={links.data ?? []}
            onDone={() => setEditing(null)}
          />
        )}
      </ResponsiveDialog>
    </PageShell>
  )
}

function ContactForm({ groupId, contact, all, links, onDone }: {
  groupId: string
  contact: Contact | null
  all: Contact[]
  links: Link[]
  onDone: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState(contact?.name ?? '')
  const [kind, setKind] = useState<Kind>(contact?.kind ?? 'individual')
  const [categoryId, setCategoryId] = useState(contact?.default_category_id ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [taxId, setTaxId] = useState(contact?.tax_id ?? '')
  const [banks, setBanks] = useState<Bank[]>(contact?.banks ?? [])
  const initialLinks = contact
    ? links.filter((l) => l.brand_id === contact.id || l.business_id === contact.id)
      .map((l) => (l.brand_id === contact.id ? l.business_id : l.brand_id))
    : []
  const [linked, setLinked] = useState<string[]>(initialLinks)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const categories = useQuery({
    queryKey: ['categories', groupId, 'expense', 'ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts').select('id, name')
        .eq('group_id', groupId).eq('type', 'expense').is('system_key', null).is('archived_at', null).eq('is_placeholder', false)
        .order('name')
      if (error) throw error
      return data
    },
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['directory', groupId] })
    void queryClient.invalidateQueries({ queryKey: ['brand-businesses', groupId] })
    void queryClient.invalidateQueries({ queryKey: ['contacts', groupId] })
  }

  const save = useMutation({
    mutationFn: () => callFunction('contact-save', {
      id: contact?.id, name: name.trim(), kind,
      default_category_id: kind === 'brand' ? categoryId || null : null,
      phone, email, tax_id: kind === 'business' ? taxId : null,
      links: kind === 'individual' ? [] : linked,
      bank_accounts: banks.filter((b) => b.iban.trim()),
    }),
    onSuccess: () => { refresh(); onDone() },
  })

  const archive = useMutation({
    mutationFn: () => callFunction('contact-archive', { id: contact!.id }),
    onSuccess: () => { refresh(); onDone() },
  })

  const otherKind: Kind | null = kind === 'brand' ? 'business' : kind === 'business' ? 'brand' : null
  const candidates = otherKind ? all.filter((c) => c.kind === otherKind && c.id !== contact?.id) : []

  function copy(iban: string) {
    void navigator.clipboard.writeText(iban).then(() => toast.add({ title: t('directory.copied'), timeout: 2000 }))
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="c-name">{t(kind === 'business' ? 'directory.legalName' : 'directory.name')}</FieldLabel>
          <Input id="c-name" required maxLength={100} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <ToggleGroup
          value={[kind]} spacing={2} className="grid w-full grid-cols-3" aria-label={t('directory.kind')}
          onValueChange={(v) => { if (v[0]) { setKind(v[0] as Kind); setLinked([]) } }}
        >
          {(['individual', 'brand', 'business'] as const).map((k) => (
            <ToggleGroupItem key={k} value={k} variant="outline" size="sm">{t(`directory.kinds.${k}`)}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        {kind === 'brand' && (
          <Field>
            <FieldLabel>{t('directory.defaultCategory')}</FieldLabel>
            <OptionSelect
              value={categoryId} onChange={setCategoryId} label={t('directory.defaultCategory')}
              options={[{ value: '', label: '—' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            />
            <FieldDescription>{t('directory.defaultCategoryHint')}</FieldDescription>
          </Field>
        )}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" />}>
            {t(detailsOpen ? 'directory.hideDetails' : 'directory.details')}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <FieldGroup className="pt-3">
              {otherKind && (
                <Field>
                  <FieldLabel>{t(kind === 'brand' ? 'directory.businesses' : 'directory.brands')}</FieldLabel>
                  {candidates.length === 0 && <FieldDescription>{t('directory.noCandidates')}</FieldDescription>}
                  <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                    {candidates.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={linked.includes(c.id)}
                          onCheckedChange={(on) => setLinked(on ? [...linked, c.id] : linked.filter((x) => x !== c.id))}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </Field>
              )}
              {kind !== 'brand' && (
                <>
                  <Field>
                    <FieldLabel htmlFor="c-phone">{t('directory.phone')}</FieldLabel>
                    <Input id="c-phone" type="tel" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="c-email">{t('directory.email')}</FieldLabel>
                    <Input id="c-email" type="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} />
                  </Field>
                </>
              )}
              {kind === 'business' && (
                <Field>
                  <FieldLabel htmlFor="c-tax">{t('directory.taxId')}</FieldLabel>
                  <Input id="c-tax" maxLength={20} inputMode="numeric" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
                </Field>
              )}
              {kind !== 'brand' && (
                <Field>
                  <FieldLabel>{t('directory.iban')}</FieldLabel>
                  {banks.map((b, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        aria-label={t('directory.bankName')} placeholder={t('directory.bankName')} className="w-28 shrink-0" maxLength={60}
                        value={b.bank_name ?? ''} onChange={(e) => setBanks(banks.map((x, j) => (j === i ? { ...x, bank_name: e.target.value } : x)))}
                      />
                      <Input
                        aria-label="IBAN" placeholder="TR.." maxLength={40} autoComplete="off"
                        value={b.iban} onChange={(e) => setBanks(banks.map((x, j) => (j === i ? { ...x, iban: e.target.value } : x)))}
                      />
                      {b.iban && (
                        <Button type="button" size="icon" variant="ghost" aria-label={t('directory.copy')} onClick={() => copy(b.iban)}><CopyIcon /></Button>
                      )}
                      <Button type="button" size="icon" variant="ghost" aria-label={t('entry.split.remove')} onClick={() => setBanks(banks.filter((_, j) => j !== i))}>
                        <XIcon />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setBanks([...banks, { bank_name: '', iban: '' }])}>
                    <PlusIcon data-icon="inline-start" />{t('directory.addIban')}
                  </Button>
                </Field>
              )}
            </FieldGroup>
          </CollapsibleContent>
        </Collapsible>
        <FormError message={save.error ? errorMessage(t, save.error) : archive.error ? errorMessage(t, archive.error) : null} />
        <div className="flex flex-wrap justify-between gap-2">
          {contact ? (
            <Button type="button" variant="ghost" className="text-destructive" disabled={archive.isPending} onClick={() => archive.mutate()}>
              {t('directory.archive')}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onDone}>{t('entry.cancel')}</Button>
            <Button type="submit" disabled={save.isPending}>{t('entry.save')}</Button>
          </div>
        </div>
      </FieldGroup>
    </form>
  )
}
