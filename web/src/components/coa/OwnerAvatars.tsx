import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { avatarSrc, initials } from '@/lib/avatar'
import { shown, type AccountNode, type Member } from '@/lib/ledger'

export function MemberAvatar({ member, className }: { member?: Member; className?: string }) {
  return (
    <Avatar size="sm" className={className}>
      <AvatarImage src={avatarSrc(member?.avatarPath)} alt="" />
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
  const owned = accounts.filter((a) => a.owner_member_id)
  if (!owned.length) return null
  return (
    <Tooltip>
      <TooltipTrigger render={<AvatarGroup className="ms-1 shrink-0 -space-x-1" />}>
        {owned.slice(0, MAX).map((a) => <MemberAvatar key={a.id} member={members.get(a.owner_member_id!)} />)}
        {owned.length > MAX && <AvatarGroupCount className="size-6 text-xs">+{owned.length - MAX}</AvatarGroupCount>}
      </TooltipTrigger>
      <TooltipContent>
        <ul className="flex flex-col gap-1">
          {owned.map((a) => {
            const v = shown(a.type, a.net)
            return (
              <li key={a.id} className="flex items-center justify-between gap-4">
                <span>{members.get(a.owner_member_id!)?.name ?? '—'}</span>
                <span className="tabular-nums">{fmt(v, a.currency)} {a.currency}</span>
              </li>
            )
          })}
        </ul>
      </TooltipContent>
    </Tooltip>
  )
}
