import { CircleAlertIcon, TriangleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AccountPicker } from '@/components/journal/AccountPicker'
import type { AccountNode } from '@/lib/ledger'
import type { QuickLine } from '@/lib/quick'

// One labelled field with its message under it: an error (red), else a warning (muted, with an icon), else a hint.
export function Field({ label, className, children, error, warning, hint, onTouch }: {
  label: string; className?: string; children: ReactNode; error?: string; warning?: string; hint?: string; onTouch?: () => void
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`} onBlurCapture={onTouch}>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {label}
        {children}
      </label>
      <Msg error={error} warning={warning} hint={hint} />
    </div>
  )
}

export function Msg({ error, warning, hint }: { error?: string; warning?: string; hint?: string }) {
  if (error) return <p className="flex items-start gap-1 text-xs text-destructive" role="alert"><CircleAlertIcon className="mt-0.5 size-3 shrink-0" />{error}</p>
  if (warning) return <p className="flex items-start gap-1 text-xs text-muted-foreground"><TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />{warning}</p>
  if (hint) return <p className="text-xs text-muted-foreground">{hint}</p>
  return null
}

export function Picker({ accounts, value, onChange, label, invalid }: {
  accounts: AccountNode[]; value: string; onChange: (id: string) => void; label: string; invalid?: boolean
}) {
  return (
    <AccountPicker
      accounts={accounts} value={value} onChange={onChange} invalid={invalid} aria-label={label}
      className="rounded-3xl bg-input/50 px-1 text-foreground [&_input]:rounded-3xl"
    />
  )
}

// The journal entry the form will post (Borç / Alacak), so the user sees the booking before saving.
export function Preview({ lines, byId, base, fmt }: {
  lines: QuickLine[]; byId: Map<string, AccountNode>; base: string; fmt: (decimal: string, cur: string) => string
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{t('quick.preview')}</div>
      <table className="w-full">
        <thead className="text-xs text-muted-foreground">
          <tr className="[&>th]:px-1 [&>th]:text-left [&>th]:font-medium">
            <th>{t('ledger.account')}</th>
            <th className="w-36 !text-right">{t('ledger.debit')}</th>
            <th className="w-36 !text-right">{t('ledger.credit')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const a = byId.get(l.account_id)
            const cur = a?.currency ?? base
            const cell = (side: 'debit' | 'credit') => (l.side === side
              ? <>{fmt(l.amount, cur)}{cur !== base && <span className="ml-1 text-xs text-muted-foreground">{cur}</span>}</>
              : '')
            return (
              <tr key={i} className="[&>td]:px-1 [&>td]:py-0.5">
                <td className={l.side === 'credit' ? 'pl-8' : ''}>
                  {a?.name}
                  {l.memo && <span className="ml-2 text-xs text-muted-foreground">{l.memo}</span>}
                </td>
                <td className="text-right font-mono tabular-nums">{cell('debit')}</td>
                <td className="text-right font-mono tabular-nums">{cell('credit')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
