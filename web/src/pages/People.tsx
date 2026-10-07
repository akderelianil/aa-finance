import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { PageShell, FormError } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { formatMinor } from '@/lib/money'
import { supabase } from '@/lib/supabase'

const ACTIONS = ['lend', 'collect', 'borrow', 'repay'] as const
type Action = (typeof ACTIONS)[number]
const today = () => new Date().toLocaleDateString('sv-SE')

type BalanceRow = { contact_id: string; net_base_amount: number; contact: { name: string } | null }

export default function People({ membership }: { membership: Membership }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const currency = membership.group.base_currency
  const [action, setAction] = useState<Action>('lend')
  const [contact, setContact] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)

  const balances = useQuery({
    queryKey: ['contact-balances', membership.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_balances').select('contact_id, net_base_amount, contact:contacts(name)')
        .eq('member_id', membership.id).overrideTypes<BalanceRow[]>()
      if (error) throw error
      // Alacak (+) ve borç (−) kişi başına toplanır: + kişi bana borçlu, − ben kişiye borçluyum.
      const byContact = new Map<string, { name: string; net: number }>()
      for (const r of data) {
        const cur = byContact.get(r.contact_id) ?? { name: r.contact?.name ?? '—', net: 0 }
        cur.net += Number(r.net_base_amount)
        byContact.set(r.contact_id, cur)
      }
      return [...byContact.values()].filter((c) => c.net !== 0).sort((a, b) => a.name.localeCompare(b.name))
    },
  })

  const contacts = useQuery({
    queryKey: ['contacts', membership.group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts').select('name').eq('group_id', membership.group.id).is('archived_at', null).order('name')
      if (error) throw error
      return data.map((r) => r.name)
    },
  })

  const save = useMutation({
    mutationFn: () =>
      callFunction('debt-create', { action, contact_name: contact, amount: amount.replace(',', '.'), date }),
    onSuccess: () => {
      setAmount(''); setContact(''); setDate(today())
      void queryClient.invalidateQueries({ queryKey: ['contact-balances', membership.id] })
      void queryClient.invalidateQueries({ queryKey: ['contacts', membership.group.id] })
      void queryClient.invalidateQueries({ queryKey: ['entries', membership.group.id] })
      void queryClient.invalidateQueries({ queryKey: ['accounts', membership.group.id] })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <PageShell>
      <Button variant="ghost" className="self-start" nativeButton={false} render={<Link to="/ayarlar" />}>{t('common.back')}</Button>
      <Card>
        <CardHeader><CardTitle>{t('people.title')}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {balances.data?.length === 0 && <p className="text-sm text-muted-foreground">{t('people.empty')}</p>}
          {balances.data?.map((c) => (
            <div key={c.name} className="flex items-center justify-between border-b pb-2 last:border-b-0">
              <span className="font-medium">{c.name}</span>
              <span className={c.net > 0 ? 'text-green-600' : 'text-destructive'}>
                {t(c.net > 0 ? 'people.owesYou' : 'people.youOwe')} {formatMinor(Math.abs(c.net), currency, i18n.language)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <form onSubmit={onSubmit}>
          <CardHeader><CardTitle>{t('people.add')}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map((a) => (
                <Button key={a} type="button" variant={action === a ? 'default' : 'outline'} onClick={() => setAction(a)}>
                  {t(`people.action.${a}`)}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-contact">{t('people.person')}</Label>
              <Input id="p-contact" required maxLength={100} autoComplete="off" list="p-contact-list" value={contact} onChange={(e) => setContact(e.target.value)} />
              <datalist id="p-contact-list">{contacts.data?.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-amount">{t('entry.amount')} ({currency})</Label>
              <Input id="p-amount" required inputMode="decimal" autoComplete="off" placeholder="0,00" pattern="[0-9]+([.,][0-9]+)?" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-date">{t('entry.date')}</Label>
              <Input id="p-date" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <FormError message={save.error ? errorMessage(t, save.error) : null} />
            <Button type="submit" disabled={save.isPending}>{t('entry.save')}</Button>
          </CardContent>
        </form>
      </Card>
    </PageShell>
  )
}
