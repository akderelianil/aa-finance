import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { initials, useAvatarSrc } from '@/lib/avatar'
import { shown, type AccountNode, type Member } from '@/lib/ledger'

export function MemberAvatar({ member, className }: { member?: Member; className?: string }) {
  const src = useAvatarSrc(member?.avatarPath)
  return (
    <Avatar size="sm" className={className}>
      <AvatarImage src={src} alt="" />
      <AvatarFallback>{initials(member?.name)}</AvatarFallback>
    </Avatar>
  )
}

type Props = {
  /** The owners' accounts: the row itself, or the children of a folded person row. */
  accounts: AccountNode[]
  members: Map<string, Member>
  fmt: (minor: number, currency: string) => string
}

const MAX = 3

// Avatars of the people who hold this account; the tooltip lists each person's balance.
export function OwnerAvatars({ accounts, members, fmt }: Props) {
  const { t } = useTranslation()
  // A single account without an owner has nothing to show; in a folded row, no owner reads "Unknown".
  const owned = accounts
  if (owned.length === 1 && !owned[0].owner_member_id) return null
  return (
    <Tooltip>
      <TooltipTrigger render={<AvatarGroup className="ms-1 shrink-0 -space-x-1" />}>
        {owned.slice(0, MAX).map((a) => <MemberAvatar key={a.id} member={members.get(a.owner_member_id ?? '')} />)}
        {owned.length > MAX && <AvatarGroupCount className="size-6 text-xs">+{owned.length - MAX}</AvatarGroupCount>}
      </TooltipTrigger>
      <TooltipContent>
        <ul className="flex flex-col gap-1">
          {owned.map((a) => {
            const v = shown(a.type, a.net)
            return (
              <li key={a.id} className="flex items-center justify-between gap-4">
                <span>{members.get(a.owner_member_id ?? '')?.name ?? t('coa.unknownOwner')}</span>
                <span className="tabular-nums">{fmt(v, a.currency)} {a.currency}</span>
              </li>
            )
          })}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}
