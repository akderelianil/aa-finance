import {
  BookOpenIcon, ChartPieIcon, ContactIcon, LayoutDashboardIcon, ListTreeIcon, PlusIcon, SettingsIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import type { Membership } from '@/auth/useMembership'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { GroupHeader } from './GroupHeader'
import { NavUser } from './NavUser'
import { QuickTransactionDialog, type QuickKind } from './quick/QuickTransactionDialog'
import { InsideAppShell } from './PageShell'

const ITEMS = [
  { to: '/anasayfa', key: 'home', icon: LayoutDashboardIcon, end: false },
  { to: '/hesaplar', key: 'accounts', icon: ListTreeIcon, end: false },
  { to: '/yevmiye', key: 'journal', icon: BookOpenIcon, end: false },
  { to: '/raporlar', key: 'reports', icon: ChartPieIcon, end: false },
  { to: '/rehber', key: 'directory', icon: ContactIcon, end: false },
  { to: '/ayarlar', key: 'settings', icon: SettingsIcon, end: false },
] as const

// Icon rail: 4rem wide, large icons, labels in tooltips. The trigger expands it to show labels.
const BUTTON = 'group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center [&_svg]:size-5'

function isActive(pathname: string, to: string, end: boolean) {
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
}

// Desktop only (v1): left sidebar.
export function AppShell({ membership }: { membership: Membership }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const { pathname } = useLocation()
  const [quick, setQuick] = useState<QuickKind | null>(null)
  const user = {
    name: membership.displayName ?? session?.user.email ?? '',
    email: session?.user.email ?? '',
    avatarPath: membership.avatarUrl,
  }

  return (
    <SidebarProvider defaultOpen={false} style={{ '--sidebar-width-icon': '4rem' } as React.CSSProperties}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <GroupHeader group={membership.group} />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={t('nav.quick')} onClick={() => setQuick('expense')}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                  >
                    <PlusIcon />
                    <span>{t('nav.quick')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {ITEMS.map(({ to, key, icon: Icon, end }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      tooltip={t(`nav.${key}`)}
                      isActive={isActive(pathname, to, end)}
                      className={cn(BUTTON, 'data-active:bg-primary data-active:text-primary-foreground data-active:hover:bg-primary/90 data-active:hover:text-primary-foreground')}
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
      <QuickTransactionDialog kind={quick} onClose={() => setQuick(null)} membership={membership} />
    </SidebarProvider>
  )
}
