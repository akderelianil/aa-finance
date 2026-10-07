import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { EntryRow } from '@/components/RecentEntries'

type Kind = 'expense' | 'income'

const today = () => new Date().toLocaleDateString('sv-SE')

// editing verilirse form o kaydı düzenler (üst bileşen key={editing.id} ile yeniden kurar).
export function QuickEntry({
  membership, editing, onDone,
}: { membership: Membership; editing?: EntryRow | null; onDone?: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const groupId = membership.group.id
  const [kind, setKind] = useState<Kind>(editing?.kind ?? 'expense')
  const [amount, setAmount] = useState(editing?.amount ?? '')
  const [date, setDate] = useState(editing?.entry_date ?? today())
  const [contact, setContact] = useState(editing?.contact ?? '')
  const [category, setCategory] = useState(editing?.category ?? '')
  const [accountId, setAccountId] = useState('')
  const [saved, setSaved] = useState(false)

  const categories = useQuery({
    queryKey: ['categories', groupId, kind],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts').select('name')
        .eq('group_id', groupId).eq('type', kind).is('system_key', null).is('archived_at', null)
        .order('name')
      if (error) throw error
      return data.map((r) => r.name)
    },
  })

  const accounts = useQuery({
    queryKey: ['accounts', groupId, 'mine'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts').select('id, name')
        .eq('owner_member_id', membership.id).in('type', ['asset', 'liability']).is('system_key', null)
        .is('archived_at', null).order('created_at')
      if (error) throw error
      return data
    },
  })

  const contacts = useQuery({
    queryKey: ['contacts', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts').select('name').eq('group_id', groupId).is('archived_at', null).order('name')
      if (error) throw error
      return data.map((r) => r.name)
    },
  })

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        amount: amount.replace(',', '.'),
        date,
        category_name: category,
        contact_name: contact,
      }
      return editing
        ? callFunction('transaction-update', { entry_id: editing.id, ...payload })
        : callFunction('transaction-create', {
            kind, ...payload, contact_name: contact || undefined, account_id: accountId || undefined,
          })
    },
    onSuccess: () => {
      if (!editing) {
        setAmount('')
        setContact('')
        setCategory('')
        setDate(today())
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
      void queryClient.invalidateQueries({ queryKey: ['categories', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['contacts', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['entries', groupId] })
      onDone?.()
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    save.mutate()
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle>{editing ? t('entry.editTitle') : t('entry.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          {!editing && (
            <div className="grid grid-cols-2 gap-2">
              {(['expense', 'income'] as const).map((k) => (
                <Button
                  key={k} type="button" variant={kind === k ? 'default' : 'outline'}
                  onClick={() => { setKind(k); setCategory('') }}
                >
                  {t(`entry.kind.${k}`)}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="amount">{t('entry.amount')} ({membership.group.base_currency})</Label>
            <Input
              id="amount" required inputMode="decimal" autoComplete="off" placeholder="0,00"
              pattern="[0-9]+([.,][0-9]+)?" value={amount} onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category">{t('entry.category')}</Label>
            <Input
              id="category" required maxLength={60} autoComplete="off" list="category-list"
              value={category} onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="category-list">
              {categories.data?.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contact">{t(`entry.contact.${kind}`)}</Label>
            <Input
              id="contact" maxLength={100} autoComplete="off" list="contact-list"
              value={contact} onChange={(e) => setContact(e.target.value)}
            />
            <datalist id="contact-list">
              {contacts.data?.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
          {!editing && (accounts.data?.length ?? 0) > 1 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="account">{t('accounts.account')}</Label>
              <select
                id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)}
                className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {/* Boş = otomatik (nakit hesap) */}
                <option value="">—</option>
                {accounts.data!.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">{t('entry.date')}</Label>
            <Input id="date" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <FormError message={save.error ? errorMessage(t, save.error) : null} />
          {saved && <p className="text-center text-sm text-green-600">{t('entry.saved')}</p>}
          <Button type="submit" disabled={save.isPending}>{t('entry.save')}</Button>
          {editing && (
            <Button type="button" variant="ghost" onClick={onDone}>{t('entry.cancel')}</Button>
          )}
        </CardContent>
      </form>
    </Card>
  )
}
