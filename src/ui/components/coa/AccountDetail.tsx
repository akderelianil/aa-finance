import { MoreHorizontalIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { AccountAction } from '@/components/coa/accountActions'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { shown, type AccountNode } from '@/lib/ledger'
import { cn } from '@/lib/utils'

type Props = {
  node: AccountNode | null
  base: string
  fmt: (amount: number, currency?: string) => string
  actions: AccountAction[]
}

const amountClass = (v: number) => cn('tabular-nums', v < 0 && 'text-destructive')

// Facts, figures and actions of the selected account; children shown as shares of its total.
export function AccountDetail({ node, base, fmt, actions }: Props) {
  const { t } = useTranslation()

  if (!node) {
    return (
      <Frame spacing="sm">
        <FramePanel>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t('coa.selectTitle')}</EmptyTitle>
              <EmptyDescription>{t('coa.selectBody')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </FramePanel>
      </Frame>
    )
  }

  const own = shown(node.type, node.balance)
  const total = shown(node.type, node.treeBase)
  const kids = node.children.filter((c) => !c.archived)
  const kidTotals = kids.map((c) => shown(c.type, c.treeBase))
  const kidSum = kidTotals.reduce((s, v) => s + Math.abs(v), 0)
  const primary = actions.filter((a) => a.key === 'register' || a.key === 'addChild')
  const more = actions.filter((a) => a.key !== 'register' && a.key !== 'addChild')

  return (
    <Frame spacing="sm">
      <FramePanel className="flex flex-col gap-4">
        <FrameHeader className="p-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <FrameTitle className="truncate">{node.label}</FrameTitle>
              {node.path && <p className="truncate text-xs text-muted-foreground">{node.path}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {node.locked && <Badge variant="outline">{t('coa.system')}</Badge>}
              {node.archived && <Badge variant="warning-light">{t('coa.archived')}</Badge>}
            </div>
          </div>
        </FrameHeader>

        <dl className="grid grid-cols-2 gap-4">
          {!node.placeholder && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{t('coa.own')}</dt>
              <dd className={cn('text-lg font-semibold tracking-tight', amountClass(own))}>
                {fmt(own, node.currency)} <Cur>{node.currency}</Cur>
              </dd>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{node.children.length ? t('coa.withChildren') : t('coa.balance')}</dt>
            <dd className={cn('text-lg font-semibold tracking-tight', amountClass(total))}>
              {fmt(total)} <Cur>{base}</Cur>
            </dd>
          </div>
        </dl>

        <dl className="flex flex-col divide-y text-sm">
          <Fact label={t('coa.type')}>{node.placeholder ? t('coa.placeholder') : t(`ledger.type.${node.type}`)}</Fact>
          <Fact label={t('coa.currency')}>{node.currency}</Fact>
        </dl>

        {kids.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">{t('coa.breakdown')}</h3>
            <ul className="flex flex-col gap-2.5">
              {kids.map((c, i) => {
                const pct = kidSum ? Math.round((Math.abs(kidTotals[i]) / kidSum) * 100) : 0
                return (
                  <li key={c.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{c.label}</span>
                      <span className="shrink-0">
                        <span className={amountClass(kidTotals[i])}>{fmt(kidTotals[i])}</span>
                        <span className="ms-2 inline-block w-9 text-end text-xs text-muted-foreground tabular-nums">{pct}%</span>
                      </span>
                    </div>
                    <Progress value={pct} aria-label={c.label} />
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {actions.length > 0 && (
          <div className="flex items-center gap-2 border-t pt-4">
            {primary.map((a) => (
              <Button key={a.key} size="sm" variant={a.key === 'register' ? 'default' : 'outline'} onClick={a.onSelect}>{a.label}</Button>
            ))}
            {more.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={t('common.actions')} />}>
                  <MoreHorizontalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    {more.map((a) => (
                      <div key={a.key}>
                        {a.key === 'archive' && <DropdownMenuSeparator />}
                        <DropdownMenuItem variant={a.destructive ? 'destructive' : undefined} onClick={a.onSelect}>{a.label}</DropdownMenuItem>
                      </div>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </FramePanel>
    </Frame>
  )
}

function Cur({ children }: { children: ReactNode }) {
  return <span className="text-xs font-normal text-muted-foreground">{children}</span>
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
