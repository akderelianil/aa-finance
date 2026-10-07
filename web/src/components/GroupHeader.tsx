import { HomeIcon, UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import type { Membership } from '@/auth/useMembership'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { avatarSrc } from '@/lib/avatar'

// sidebar-07 "team-switcher" yerine: tek grup, görsel + ad + tür.
export function GroupHeader({ group }: { group: Membership['group'] }) {
  const { t } = useTranslation()
  const Icon = group.kind === 'group' ? UsersIcon : HomeIcon
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip={group.name} render={<NavLink to="/" />}>
          <Avatar className="rounded-lg after:rounded-lg">
            <AvatarImage src={avatarSrc(group.avatar_url)} alt="" className="rounded-lg" />
            <AvatarFallback className="rounded-lg bg-primary text-primary-foreground"><Icon className="size-4" /></AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{group.name}</span>
            <span className="truncate text-xs">{t(`profile.${group.kind}`)}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
