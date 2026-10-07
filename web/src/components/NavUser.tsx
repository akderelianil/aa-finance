import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ThemeToggle } from '@/components/ThemeToggle'
import { avatarSrc, initials } from '@/lib/avatar'
import { supabase } from '@/lib/supabase'

export type NavUserInfo = { name: string; email: string; avatarPath: string | null }

function UserRow({ user }: { user: NavUserInfo }) {
  return (
    <>
      <Avatar>
        <AvatarImage src={avatarSrc(user.avatarPath)} alt={user.name} />
        <AvatarFallback>{initials(user.name)}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{user.name}</span>
        <span className="truncate text-xs">{user.email}</span>
      </div>
    </>
  )
}

// sidebar-07 "nav-user": sidebar-footer'da kullanıcı; menüde Ayarlar, tema/dil, çıkış.
export function NavUser({ user }: { user: NavUserInfo }) {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}>
            <UserRow user={user} />
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56" side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm"><UserRow user={user} /></div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link to="/ayarlar" />}>
                <SettingsIcon />
                {t('nav.settings')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="flex flex-col gap-2 px-2 py-1.5">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void supabase.auth.signOut()}>
              <LogOutIcon />
              {t('common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
