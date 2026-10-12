import { CheckIcon, ChevronsUpDownIcon, EyeIcon, HomeIcon, UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { MemberAvatar } from '@/components/coa/OwnerAvatars'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { levelOf, useMemberAccess } from '@/lib/access'
import { avatarSrc } from '@/lib/avatar'
import { useMembers } from '@/lib/ledger'
import { useViewAs } from '@/lib/viewAs'

// sidebar-07 "team-switcher": the group; its menu lists the members to switch between.
export function GroupHeader({ membership }: { membership: Membership }) {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const { group } = membership
  const { activeId, setActiveId } = useViewAs()
  const members = useMembers()
  const access = useMemberAccess()
  const Icon = group.kind === 'group' ? UsersIcon : HomeIcon
  const list = members.data ?? []

  // What the signed-in member may do with that member's entries.
  const right = (id: string) => {
    if (id === membership.id) return t('members.self')
    if (membership.role === 'admin') return t('members.admin')
    return t(`access.${levelOf(access.data ?? [], membership.id, id)}`)
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" tooltip={group.name} className="aria-expanded:bg-muted" />}>
            <Avatar className="rounded-lg after:rounded-lg">
              <AvatarImage src={avatarSrc(group.avatar_url)} alt="" className="rounded-lg" />
              <AvatarFallback className="rounded-lg bg-primary text-primary-foreground"><Icon className="size-4" /></AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{group.name}</span>
              <span className="truncate text-xs">{t(`profile.${group.kind}`)}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-60" side={isMobile ? 'bottom' : 'right'} align="start" sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t('members.title')}</DropdownMenuLabel>
              {list.map((m) => (
                <DropdownMenuItem key={m.id} onClick={() => setActiveId(m.id)}>
                  <MemberAvatar member={m} />
                  <span className="flex-1 truncate">{m.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {m.id !== membership.id && right(m.id) === t('access.view') && <EyeIcon className="size-3" />}
                    {right(m.id)}
                  </span>
                  {m.id === activeId && <CheckIcon />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<NavLink to="/hesaplar" />}>{t('nav.accounts')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
