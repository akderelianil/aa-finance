import { useTranslation } from 'react-i18next'
import { Frame, FramePanel } from '@/components/reui/frame'
import { ACCOUNT_TYPES, shown, type AccountNode, type AccountType } from '@/lib/ledger'
import { cn } from '@/lib/utils'

type Props = {
  roots: AccountNode[]
  active: AccountType | null
  onSelect: (type: AccountType | null) => void
  fmt: (minor: number) => string
}

// Net worth plus the five roots in one strip; a root doubles as the tree filter.
export function RootStrip({ roots, active, onSelect, fmt }: Props) {
  const { t } = useTranslation()
  const total = (type: AccountType) => {
    const root = roots.find((r) => r.type === type)
    return root ? shown(root.type, root.treeNetBase) : 0
  }
  const netWorth = total('asset') - total('liability')

  return (
    <Frame spacing="sm">
      <FramePanel className="grid grid-cols-6 divide-x p-0">
        <div className="flex flex-col gap-0.5 px-4 py-3">
          <span className="text-xs text-muted-foreground">{t('coa.netWorth')}</span>
          <span className={cn('text-lg font-semibold tracking-tight tabular-nums', netWorth < 0 && 'text-destructive')}>
            {fmt(netWorth)}
          </span>
        </div>
        {ACCOUNT_TYPES.map((type) => {
          const value = total(type)
          const on = active === type
          return (
            <button
              key={type} type="button" aria-pressed={on}
              aria-label={t('coa.filterRoot', { name: t(`ledger.type.${type}`) })}
              onClick={() => onSelect(on ? null : type)}
              className={cn(
                'flex flex-col items-start gap-0.5 px-4 py-3 text-start transition-colors hover:bg-muted/50',
                on && 'bg-muted',
              )}
            >
              <span className="text-xs text-muted-foreground">{t(`ledger.type.${type}`)}</span>
              <span className={cn('text-lg font-semibold tracking-tight tabular-nums', value < 0 && 'text-destructive')}>
                {fmt(value)}
              </span>
            </button>
          )
        })}
      </FramePanel>
    </Frame>
  )
}
