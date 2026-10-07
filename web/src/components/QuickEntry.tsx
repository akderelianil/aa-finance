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

type Kind = 'expense' | 'income'

const today = () => new Date().toLocaleDateString('sv-SE')

export function QuickEntry({ membership }: { membership: Membership }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const groupId = membership.group.id
  const [kind, setKind] = useState<Kind>('expense')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [contact, setContact] = useState('')
  const [category, setCategory] = useState('')
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

  const contacts = useQuery({
    queryKey: ['contacts', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts').select('name').eq('group_id', groupId).is('archived_at', null).order('name')
      if (error) throw error
      return data.map((r) => r.name)
    },
  })

  const create = useMutation({
    mutationFn: () =>
      callFunction('transaction-create', {
        kind,
        amount: amount.replace(',', '.'),
        date,
        category_name: category,
        contact_name: contact || undefined,
      }),
    onSuccess: () => {
      setAmount('')
      setContact('')
      setCategory('')
      setDate(today())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      void queryClient.invalidateQueries({ queryKey: ['categories', groupId] })
      void queryClient.invalidateQueries({ queryKey: ['contacts', groupId] })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    create.mutate()
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle>{t('entry.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="date">{t('entry.date')}</Label>
            <Input id="date" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <FormError message={create.error ? errorMessage(t, create.error) : null} />
          {saved && <p className="text-center text-sm text-green-600">{t('entry.saved')}</p>}
          <Button type="submit" disabled={create.isPending}>{t('entry.save')}</Button>
        </CardContent>
      </form>
    </Card>
  )
}
