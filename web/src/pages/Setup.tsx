import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { AccountFormDialog, type FormTarget } from '@/components/accounts/AccountFormDialog'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMyAccounts } from '@/lib/entry'
import { supabase } from '@/lib/supabase'

const STEPS = ['bank', 'credit_card', 'loan'] as const

// Başlangıç sihirbazı (grup kurulunca / gruba katılınca): nakit hazır; banka, kart ve kredi hesaplarını sorar.
// Her adım boş geçilebilir; hesaplar sonra Hesaplar sayfasından da eklenir.
export default function Setup({ membership }: { membership: Membership }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const accounts = useMyAccounts(membership)
  const [form, setForm] = useState<FormTarget | null>(null)
  const base = membership.group.base_currency

  const currencies = useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('currencies').select('code').order('code')
      if (error) throw error
      return data.map((r) => r.code as string)
    },
  })

  return (
    <PageShell>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('setup.title')}</h1>
        <p className="text-muted-foreground">{t('setup.intro')}</p>
      </div>
      {STEPS.map((subtype) => {
        const mine = (accounts.data ?? []).filter((a) => a.subtype === subtype)
        return (
          <Card key={subtype}>
            <CardHeader>
              <CardTitle>{t(`setup.${subtype}.title`)}</CardTitle>
              <CardDescription>{t(`setup.${subtype}.hint`)}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {mine.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm">
                  {mine.map((a) => <li key={a.id}>✓ {a.name}</li>)}
                </ul>
              )}
              <Button
                variant="outline"
                onClick={() => setForm({ mode: 'create', section: 'accounts', parent: null, subtype })}
              >
                {t(`setup.${subtype}.add`)}
              </Button>
            </CardContent>
          </Card>
        )
      })}
      <Button onClick={() => navigate('/', { replace: true })}>{t('setup.done')}</Button>
      <AccountFormDialog
        target={form}
        tree={[]}
        currencies={currencies.data ?? [base]}
        baseCurrency={base}
        onClose={() => setForm(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ['accounts', membership.group.id] })}
      />
    </PageShell>
  )
}
