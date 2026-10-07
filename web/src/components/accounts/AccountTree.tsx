import {
  BanknoteIcon, ChevronRightIcon, CreditCardIcon, FolderIcon, HandCoinsIcon, LandmarkIcon, MoreHorizontalIcon, PencilIcon,
  PiggyBankIcon, PlusIcon, Trash2Icon, TrendingUpIcon, WalletIcon, type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { TreeNode } from '@/lib/accountTree'
import { cn } from '@/lib/utils'

export type AccountRow = {
  id: string
  parent_id: string | null
  name: string
  type: string
  subtype: string | null
  currency: string | null
  owner_member_id: string | null
  is_placeholder: boolean
}
export type AccountNode = TreeNode<AccountRow>

export type GroupType = 'asset' | 'liability' | 'equity' | 'expense' | 'income'

export type AccountGroup = {
  type: GroupType
  nodes: AccountNode[]
  total: string
  // Yeni kayıt eklenebilir mi (özkaynak için hayır).
  canAdd: boolean
}

const GROUP_STYLE: Record<GroupType, { icon: LucideIcon; chip: string }> = {
  asset: { icon: WalletIcon, chip: 'bg-info/10 text-info' },
  liability: { icon: CreditCardIcon, chip: 'bg-warning/15 text-warning' },
  equity: { icon: LandmarkIcon, chip: 'bg-primary/10 text-primary' },
  expense: { icon: TrendingUpIcon, chip: 'bg-destructive/10 text-destructive' },
  income: { icon: BanknoteIcon, chip: 'bg-success/10 text-success' },
}

const SUBTYPE_ICON: Record<string, LucideIcon> = {
  cash: BanknoteIcon,
  bank: LandmarkIcon,
  credit_card: CreditCardIcon,
  loan: HandCoinsIcon,
  deposit: PiggyBankIcon,
  investment: TrendingUpIcon,
}

type Handlers = {
  balance: (n: AccountNode) => string
  canEdit: (n: AccountNode) => boolean
  onAdd: (parent: AccountNode) => void
  onEdit: (n: AccountNode) => void
  onDelete: (n: AccountNode) => void
}

function countAll(nodes: AccountNode[]): number {
  return nodes.reduce((s, n) => s + 1 + countAll(n.children), 0)
}

function Node({ node, ...rest }: Handlers & { node: AccountNode }) {
  const { t } = useTranslation()
  const has = node.children.length > 0
  const editable = rest.canEdit(node)
  const Icon = (node.subtype && SUBTYPE_ICON[node.subtype]) || (has ? FolderIcon : WalletIcon)
  return (
    <li>
      <Collapsible defaultOpen>
        <div className="flex items-center gap-2 rounded-2xl py-1 pr-1 hover:bg-muted/50">
          {has ? (
            <CollapsibleTrigger
              render={<Button variant="ghost" size="icon-sm" className="group shrink-0" aria-label={t('accounts.expand')} />}
            >
              <ChevronRightIcon className="transition-transform group-data-[panel-open]:rotate-90" />
            </CollapsibleTrigger>
          ) : (
            <span className="size-8 shrink-0" aria-hidden />
          )}
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{node.name}</p>
          </div>
          {node.subtype && (
            <Badge variant="secondary" className="hidden sm:inline-flex">{t(`accounts.subtype.${node.subtype}`, { defaultValue: '' })}</Badge>
          )}
          {node.currency && <Badge variant="outline" className="hidden sm:inline-flex">{node.currency}</Badge>}
          <span className="shrink-0 text-sm font-medium tabular-nums">{rest.balance(node)}</span>
          {editable ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={t('accounts.actions')} />}>
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => rest.onAdd(node)}>
                    <PlusIcon />{t('accounts.addChild')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => rest.onEdit(node)}>
                    <PencilIcon />{t('entry.edit')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant="destructive" onClick={() => rest.onDelete(node)}>
                    <Trash2Icon />{t('accounts.delete')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="size-8 shrink-0" aria-hidden />
          )}
        </div>
        {has && (
          <CollapsibleContent>
            <ul className="ml-5 flex flex-col border-l pl-2">
              {node.children.map((c) => <Node key={c.id} node={c} {...rest} />)}
            </ul>
          </CollapsibleContent>
        )}
      </Collapsible>
    </li>
  )
}

type Props = Handlers & {
  groups: AccountGroup[]
  onAddRoot: (type: GroupType) => void
}

// Tek ağaç: Varlık / Borç / Özkaynak / Gider / Gelir kökleri ve altlarında hesaplar.
export function AccountTree({ groups, onAddRoot, ...rest }: Props) {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-col gap-1">
      {groups.map((g) => {
        const { icon: Icon, chip } = GROUP_STYLE[g.type]
        const n = countAll(g.nodes)
        return (
          <li key={g.type}>
            <Collapsible defaultOpen>
              <div className="flex items-center gap-2 rounded-2xl bg-muted/40 py-1.5 pr-2 pl-1">
                <CollapsibleTrigger
                  render={<Button variant="ghost" size="icon-sm" className="group shrink-0" aria-label={t('accounts.expand')} />}
                >
                  <ChevronRightIcon className="transition-transform group-data-[panel-open]:rotate-90" />
                </CollapsibleTrigger>
                <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl', chip)} aria-hidden>
                  <Icon className="size-4" />
                </span>
                <p className="min-w-0 flex-1 truncate font-semibold">{t(`accounts.group.${g.type}`)}</p>
                <Badge variant="secondary">{n}</Badge>
                <span className="shrink-0 font-semibold tabular-nums">{g.total}</span>
                {g.canAdd ? (
                  <Button
                    variant="ghost" size="icon-sm" className="shrink-0"
                    aria-label={t(g.type === 'expense' || g.type === 'income' ? 'accounts.addCategory' : 'accounts.addAccount')}
                    onClick={() => onAddRoot(g.type)}
                  >
                    <PlusIcon />
                  </Button>
                ) : (
                  <span className="size-8 shrink-0" aria-hidden />
                )}
              </div>
              <CollapsibleContent>
                {g.nodes.length === 0 ? (
                  <p className="py-2 pl-12 text-sm text-muted-foreground">{t('accounts.empty')}</p>
                ) : (
                  <ul className="mt-1 ml-5 flex flex-col border-l pl-2">
                    {g.nodes.map((nd) => <Node key={nd.id} node={nd} {...rest} />)}
                  </ul>
                )}
              </CollapsibleContent>
            </Collapsible>
          </li>
        )
      })}
    </ul>
  )
}
