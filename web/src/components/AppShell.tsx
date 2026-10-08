import { BookOpenIcon, ChartPieIcon, ListTreeIcon, SettingsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import type { Membership } from '@/auth/useMembership'
import { Separator } from '@/components/ui/separator'
import { EntryDialogProvider } from './EntryDialog'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger,
} from '@/components/ui/sidebar'
import { GroupHeader } from './GroupHeader'
import { NavUser } from './NavUser'
import { InsideAppShell } from './PageShell'

const ITEMS = [
  { to: '/hesaplar', key: 'accounts', icon: ListTreeIcon, end: false },
  { to: '/yevmiye', key: 'journal', icon: BookOpenIcon, end: false },
  { to: '/raporlar', key: 'reports', icon: ChartPieIcon, end: false },
  { to: '/ayarlar', key: 'settings', icon: SettingsIcon, end: false },
] as const

function isActive(pathname: string, to: string, end: boolean) {
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
}

// Desktop only (v1): left sidebar.
export function AppShell({ membership }: { membership: Membership }) {
  return (
    <EntryDialogProvider membership={membership}>
      <Shell membership={membership} />
    </EntryDialogProvider>
  )
}

function Shell({ membership }: { membership: Membership }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { pathname } = useLocation()
  const user = {
    name: membership.displayName ?? session?.user.email ?? '',
    email: session?.user.email ?? '',
    avatarPath: membership.avatarUrl,
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <GroupHeader group={membership.group} />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {ITEMS.map(({ to, key, icon: Icon, end }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      tooltip={t(`nav.${key}`)}
                      isActive={isActive(pathname, to, end)}
                      render={<NavLink to={to} end={end} />}
                    >
                      <Icon />
                      <span>{t(`nav.${key}`)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger aria-label={t('profile.toggle')} />
          <Separator orientation="vertical" className="h-4" />
        </header>
        <div className="flex w-full flex-col gap-4 px-6 pt-2 pb-8">
          <InsideAppShell.Provider value><Outlet /></InsideAppShell.Provider>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
