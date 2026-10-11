import { MoreHorizontalIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { shown, type AccountNode } from '@/lib/ledger'
import { cn } from '@/lib/utils'

type Props = {
  node: AccountNode | null
  base: string
  ownerName?: string
  fmt: (minor: number, currency: string) => string
  onOpenRegister: (n: AccountNode) => void
  onAddChild: (n: AccountNode) => void
  onEdit: (n: AccountNode) => void
  onArchive: (n: AccountNode) => void
  onDelete: (n: AccountNode) => void
}

const amountClass = (v: number) => cn('tabular-nums', v < 0 && 'text-destructive')

// Facts, figures and actions of the selected account; children shown as shares of its total.
export function AccountDetail({ node, base, ownerName, fmt, onOpenRegister, onAddChild, onEdit, onArchive, onDelete }: Props) {
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

  const own = shown(node.type, node.net)
  const total = shown(node.type, node.treeNetBase)
  const group = node.depth === 0 || node.is_placeholder
  const kids = node.children.filter((c) => !c.archived_at)
  const kidTotals = kids.map((c) => shown(c.type, c.treeNetBase))
  const kidSum = kidTotals.reduce((s, v) => s + Math.abs(v), 0)
  const canEdit = !(node.locked && node.is_placeholder)
  const canArchive = !node.system_key && !node.locked

  return (
    <Frame spacing="sm">
      <FramePanel className="flex flex-col gap-4">
        <FrameHeader className="p-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <FrameTitle className="truncate">{node.name}</FrameTitle>
              {node.path && <p className="truncate text-xs text-muted-foreground">{node.path}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {node.system_key && <Badge variant="outline">{t('coa.system')}</Badge>}
              {node.archived_at && <Badge variant="warning-light">{t('coa.archived')}</Badge>}
            </div>
          </div>
        </FrameHeader>

        <dl className="grid grid-cols-2 gap-4">
          {!node.is_placeholder && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{t('coa.own')}</dt>
              <dd className={cn('text-lg font-semibold tracking-tight', amountClass(own))}>{fmt(own, node.currency)} <Cur>{node.currency}</Cur></dd>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">
              {node.children.length ? t('coa.withChildren') : t('ledger.balance')}
            </dt>
            <dd className={cn('text-lg font-semibold tracking-tight', amountClass(total))}>{fmt(total, base)} <Cur>{base}</Cur></dd>
          </div>
        </dl>

        <dl className="flex flex-col divide-y text-sm">
          <Fact label={t('coa.kind')}>
            {group ? t('coa.placeholder') : node.subtype ? t(`ledger.subtype.${node.subtype}`) : t(`ledger.type.${node.type}`)}
          </Fact>
          <Fact label={t('ledger.currency')}>{node.currency}</Fact>
          {ownerName && <Fact label={t('ledger.owner')}>{ownerName}</Fact>}
        </dl>

        {kids.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">{t('coa.breakdown')}</h3>
            <ul className="flex flex-col gap-2.5">
              {kids.map((c, i) => {
                const pct = kidSum ? Math.round((Math.abs(kidTotals[i]) / kidSum) * 100) : 0
                return (
                  <li key={c.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0">
                        <span className={amountClass(kidTotals[i])}>{fmt(kidTotals[i], base)}</span>
                        <span className="ms-2 inline-block w-9 text-end text-xs text-muted-foreground tabular-nums">{pct}%</span>
                      </span>
                    </div>
                    <Progress value={pct} aria-label={c.name} />
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 border-t pt-4">
          {!node.is_placeholder && (
            <Button size="sm" onClick={() => onOpenRegister(node)}>{t('coa.openRegister')}</Button>
          )}
          {!node.system_key && (
            <Button size="sm" variant="outline" onClick={() => onAddChild(node)}>{t('coa.addChild')}</Button>
          )}
          {(canEdit || canArchive) && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={t('ledger.actions')} />}>
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  {canEdit && <DropdownMenuItem onClick={() => onEdit(node)}>{t('ledger.edit')}</DropdownMenuItem>}
                  {canArchive && (
                    <DropdownMenuItem onClick={() => onArchive(node)}>
                      {node.archived_at ? t('coa.unarchive') : t('coa.archive')}
                    </DropdownMenuItem>
                  )}
                  {canArchive && (
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(node)}>{t('ledger.delete')}</DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </FramePanel>
    </Frame>
  )
}

function Cur({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-normal text-muted-foreground">{children}</span>
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
