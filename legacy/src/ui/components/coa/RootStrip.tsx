import { useTranslation } from 'react-i18next'
import { Frame, FramePanel } from '@/components/reui/frame'
import { shown, type AccountNode, type AccountType } from '@/lib/ledger'
import { cn } from '@/lib/utils'

type Props = {
  roots: AccountNode[]
  active: AccountType | null
  onSelect: (type: AccountType | null) => void
  fmt: (amount: number) => string
}

// Two rows of three: assets, liabilities, net assets; income, expense, net income. A root card doubles as the tree filter.
export function RootStrip({ roots, active, onSelect, fmt }: Props) {
  const { t } = useTranslation()
  const total = (type: AccountType) => {
    const root = roots.find((r) => r.type === type)
    return root ? shown(root.type, root.treeBase) : 0
  }

  const rows: { key: string; type?: AccountType; label: string; value: number }[][] = [
    [
      ...(['asset', 'liability'] as const).map((type) => ({ key: type, type, label: t(`ledger.type.${type}`), value: total(type) })),
      { key: 'net-assets', label: t('coa.netAssets'), value: total('asset') - total('liability') },
    ],
    [
      ...(['income', 'expense'] as const).map((type) => ({ key: type, type, label: t(`ledger.type.${type}`), value: total(type) })),
      { key: 'net-income', label: t('coa.netIncome'), value: total('income') - total('expense') },
    ],
  ]

  return (
    <Frame spacing="sm">
      <FramePanel className="flex flex-col divide-y p-0">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-3 divide-x">
            {row.map((c) => {
              const body = (
                <>
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                  <span className={cn('text-lg font-semibold tracking-tight tabular-nums', c.value < 0 && 'text-destructive')}>
                    {fmt(c.value)}
                  </span>
                </>
              )
              if (!c.type) return <div key={c.key} className="flex flex-col gap-0.5 bg-muted/30 px-4 py-3">{body}</div>
              const on = active === c.type
              return (
                <button
                  key={c.key} type="button" aria-pressed={on}
                  aria-label={t('coa.filterRoot', { name: c.label })}
                  onClick={() => onSelect(on ? null : c.type!)}
                  className={cn('flex flex-col items-start gap-0.5 px-4 py-3 text-start transition-colors hover:bg-muted/50', on && 'bg-muted')}
                >
                  {body}
                </button>
              )
            })}
          </div>
        ))}
      </FramePanel>
    </Frame>
  )
}
