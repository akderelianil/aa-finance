import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormError } from '@/components/PageShell'
import { OptionSelect } from '@/components/OptionSelect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { callFunction } from '@/lib/api'
import { errorMessage } from '@/lib/errors'

type Mine = { id: string; name: string; currency: string | null }
const AMOUNT = '[0-9]+([.,][0-9]+)?'

export function TransferCards({ mine, groupId, currency }: { mine: Mine[]; groupId: string; currency: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [xFrom, setXFrom] = useState('')
  const [xTo, setXTo] = useState('')
  const [xFromAmt, setXFromAmt] = useState('')
  const [xToAmt, setXToAmt] = useState('')

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['accounts', groupId] })
    void queryClient.invalidateQueries({ queryKey: ['entries', groupId] })
  }

  const transfer = useMutation({
    mutationFn: () => callFunction('transfer-create', { from_account_id: from, to_account_id: to, amount: amount.replace(',', '.') }),
    onSuccess: () => { setAmount(''); refresh() },
  })
  const exchange = useMutation({
    mutationFn: () =>
      callFunction('fx-exchange', {
        from_account_id: xFrom, to_account_id: xTo,
        from_amount: xFromAmt.replace(',', '.'), to_amount: xToAmt.replace(',', '.'),
      }),
    onSuccess: () => { setXFromAmt(''); setXToAmt(''); refresh() },
  })

  const plain = mine.map((a) => ({ value: a.id, label: a.name }))
  const withCur = mine.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))
  const canExchange = mine.some((a) => a.currency !== currency) && mine.some((a) => a.currency === currency)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {mine.length > 1 && (
        <Card>
          <form onSubmit={(e) => { e.preventDefault(); transfer.mutate() }}>
            <CardHeader><CardTitle>{t('accounts.transfer')}</CardTitle></CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>{t('accounts.from')}</FieldLabel>
                  <OptionSelect value={from} onChange={setFrom} options={plain} placeholder={t('accounts.from')} label={t('accounts.from')} />
                </Field>
                <Field>
                  <FieldLabel>{t('accounts.to')}</FieldLabel>
                  <OptionSelect value={to} onChange={setTo} options={plain} placeholder={t('accounts.to')} label={t('accounts.to')} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="t-amount">{`${t('entry.amount')} (${currency})`}</FieldLabel>
                  <Input id="t-amount" required inputMode="decimal" autoComplete="off" pattern={AMOUNT} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </Field>
                <FormError message={transfer.error ? errorMessage(t, transfer.error) : null} />
                <Button type="submit" disabled={transfer.isPending || !from || !to}>{t('accounts.transferButton')}</Button>
              </FieldGroup>
            </CardContent>
          </form>
        </Card>
      )}
      {canExchange && (
        <Card>
          <form onSubmit={(e) => { e.preventDefault(); exchange.mutate() }}>
            <CardHeader><CardTitle>{t('accounts.exchange')}</CardTitle></CardHeader>
            <CardContent>
              <FieldGroup>
                {([['from', xFrom, setXFrom, xFromAmt, setXFromAmt], ['to', xTo, setXTo, xToAmt, setXToAmt]] as const).map(
                  ([k, v, set, amt, setAmt]) => (
                    <Field key={k}>
                      <FieldLabel>{t(`accounts.${k}`)}</FieldLabel>
                      <div className="flex gap-2">
                        <OptionSelect
                          className="min-w-0 flex-1" value={v} onChange={set} options={withCur}
                          placeholder={t(`accounts.${k}`)} label={t(`accounts.${k}`)}
                        />
                        <Input
                          required inputMode="decimal" autoComplete="off" pattern={AMOUNT} className="w-28"
                          aria-label={t('entry.amount')} placeholder={t('entry.amount')} value={amt} onChange={(e) => setAmt(e.target.value)}
                        />
                      </div>
                    </Field>
                  ),
                )}
                <FormError message={exchange.error ? errorMessage(t, exchange.error) : null} />
                <Button type="submit" disabled={exchange.isPending || !xFrom || !xTo}>{t('accounts.exchangeButton')}</Button>
              </FieldGroup>
            </CardContent>
          </form>
        </Card>
      )}
    </div>
  )
}
