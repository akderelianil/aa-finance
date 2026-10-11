import { MoreHorizontalIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AccountAction } from '@/components/coa/accountActions'
import { MemberAvatar } from '@/components/coa/OwnerAvatars'
import { Badge } from '@/components/reui/badge'
import { Frame, FrameHeader, FramePanel, FrameTitle } from '@/components/reui/frame'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { shown, type AccountNode, type Member } from '@/lib/ledger'
import { cn } from '@/lib/utils'

type Props = {
  node: AccountNode | null
  base: string
  members: Map<string, Member>
  fmt: (minor: number, currency: string) => string
  actions: AccountAction[]
}

const amountClass = (v: number) => cn('tabular-nums', v < 0 && 'text-destructive')

// Facts, figures and actions of the selected account; children shown as shares of its total.
export function AccountDetail({ node, base, members, fmt, actions }: Props) {
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
  const group = (node.depth === 0 || node.is_placeholder) && !node.personGroup
  const owner = node.owner_member_id ? members.get(node.owner_member_id) : undefined
  const kids = node.children.filter((c) => !c.archived_at)
  const kidTotals = kids.map((c) => shown(c.type, c.treeNetBase))
  const kidSum = kidTotals.reduce((s, v) => s + Math.abs(v), 0)
  const primary = actions.filter((a) => a.key === 'register' || a.key === 'addChild')
  const more = actions.filter((a) => a.key !== 'register' && a.key !== 'addChild')

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
              <dd className={cn('text-lg font-semibold tracking-tight', amountClass(own))}>
                {fmt(own, node.currency)} <Cur>{node.currency}</Cur>
              </dd>
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">
              {node.children.length ? t('coa.withChildren') : t('ledger.balance')}
            </dt>
            <dd className={cn('text-lg font-semibold tracking-tight', amountClass(total))}>
              {fmt(total, base)} <Cur>{base}</Cur>
            </dd>
          </div>
        </dl>

        <dl className="flex flex-col divide-y text-sm">
          <Fact label={t('coa.kind')}>
            {group ? t('coa.placeholder') : node.subtype ? t(`ledger.subtype.${node.subtype}`) : t(`ledger.type.${node.type}`)}
          </Fact>
          <Fact label={t('ledger.currency')}>{node.currency}</Fact>
          {owner && (
            <Fact label={t('ledger.owner')}>
              <span className="flex items-center gap-1.5"><MemberAvatar member={owner} />{owner.name}</span>
            </Fact>
          )}
        </dl>

        {kids.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">{t('coa.breakdown')}</h3>
            <ul className="flex flex-col gap-2.5">
              {kids.map((c, i) => {
                const pct = kidSum ? Math.round((Math.abs(kidTotals[i]) / kidSum) * 100) : 0
                const person = node.personGroup ? members.get(c.owner_member_id ?? '') : undefined
                const label = node.personGroup ? person?.name ?? t('coa.unknownOwner') : c.name
                return (
                  <li key={c.id} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {node.personGroup && <MemberAvatar member={person} />}
                        <span className="truncate">{label}</span>
                      </span>
                      <span className="shrink-0">
                        <span className={amountClass(kidTotals[i])}>{fmt(kidTotals[i], base)}</span>
                        <span className="ms-2 inline-block w-9 text-end text-xs text-muted-foreground tabular-nums">{pct}%</span>
                      </span>
                    </div>
                    <Progress value={pct} aria-label={label} />
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
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={t('ledger.actions')} />}>
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
