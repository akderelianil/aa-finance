import { ChevronRightIcon, MoreHorizontalIcon, PlusIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { TreeNode } from '@/lib/accountTree'

export type AccountRow = {
  id: string
  parent_id: string | null
  name: string
  type: string
  subtype: string | null
  currency: string | null
  owner_member_id: string | null
}
export type AccountNode = TreeNode<AccountRow>

type Props = {
  nodes: AccountNode[]
  balance: (n: AccountNode) => string
  canEdit: (n: AccountNode) => boolean
  onAdd: (parent: AccountNode) => void
  onEdit: (n: AccountNode) => void
  onDelete: (n: AccountNode) => void
}

function Node({ node, ...rest }: Props & { node: AccountNode }) {
  const { t } = useTranslation()
  const has = node.children.length > 0
  const editable = rest.canEdit(node)
  return (
    <li>
      <Collapsible defaultOpen>
        <div
          className="flex items-center gap-1 rounded-2xl py-1 pr-1 hover:bg-muted/50"
          style={{ paddingLeft: node.depth * 20 }}
        >
          {has ? (
            <CollapsibleTrigger
              render={<Button variant="ghost" size="icon-sm" className="group shrink-0" aria-label={t('accounts.expand')} />}
            >
              <ChevronRightIcon className="transition-transform group-data-[panel-open]:rotate-90" />
            </CollapsibleTrigger>
          ) : (
            <span className="size-8 shrink-0" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{node.name}</p>
            {node.subtype && <p className="text-xs text-muted-foreground">{t(`accounts.subtype.${node.subtype}`, { defaultValue: '' })}</p>}
          </div>
          <span className="shrink-0 text-sm tabular-nums">{rest.balance(node)}</span>
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
            <ul className="flex flex-col">
              {node.children.map((c) => <Node key={c.id} node={c} {...rest} />)}
            </ul>
          </CollapsibleContent>
        )}
      </Collapsible>
    </li>
  )
}

export function AccountTree(props: Props) {
  const { t } = useTranslation()
  if (props.nodes.length === 0) return <p className="py-2 text-sm text-muted-foreground">{t('accounts.empty')}</p>
  return (
    <ul className="flex flex-col">
      {props.nodes.map((n) => <Node key={n.id} node={n} {...props} />)}
    </ul>
  )
}
