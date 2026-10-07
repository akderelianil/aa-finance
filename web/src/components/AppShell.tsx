import { BookOpenIcon, ChartPieIcon, ContactIcon, HomeIcon, PlusIcon, WalletIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import type { Membership } from '@/auth/useMembership'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { EntryDialogProvider, useEntryDialog } from './EntryDialog'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger,
} from '@/components/ui/sidebar'
import { avatarSrc, initials } from '@/lib/avatar'
import { GroupHeader } from './GroupHeader'
import { NavUser } from './NavUser'
import { InsideAppShell } from './PageShell'

const ITEMS = [
  { to: '/', key: 'home', icon: HomeIcon, end: true },
  { to: '/islemler', key: 'journal', icon: BookOpenIcon, end: false },
  { to: '/hesaplar', key: 'accounts', icon: WalletIcon, end: false },
  { to: '/rehber', key: 'directory', icon: ContactIcon, end: false },
  { to: '/raporlar', key: 'reports', icon: ChartPieIcon, end: false },
] as const

function isActive(pathname: string, to: string, end: boolean) {
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
}

// Mobil (<md): altta 5 sekme + profil (ayarlar). Masaüstü (>=md): solda sidebar.
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
  const { open } = useEntryDialog()
  const user = {
    name: membership.displayName ?? session?.user.email ?? '',
    email: session?.user.email ?? '',
    avatarPath: membership.avatarUrl,
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="hidden md:flex">
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
        <header className="hidden h-12 shrink-0 items-center gap-2 px-4 md:flex">
          <SidebarTrigger aria-label={t('profile.toggle')} />
          <Separator orientation="vertical" className="h-4" />
        </header>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-4 pb-24 md:pb-8">
          <InsideAppShell.Provider value><Outlet /></InsideAppShell.Provider>
        </div>
        <Button
          size="lg" className="fixed right-4 bottom-20 shadow-lg md:right-6 md:bottom-6"
          aria-label={t('nav.add')} onClick={() => open()}
        >
          <PlusIcon data-icon="inline-start" />
          {t('nav.add')}
        </Button>
        <nav
          aria-label={t('nav.menu')}
          className="fixed inset-x-0 bottom-0 grid grid-cols-6 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {ITEMS.map(({ to, key, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={cn(
                'flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground',
                isActive(pathname, to, end) && 'font-medium text-primary',
              )}
            >
              <Icon className="size-5" />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
          <NavLink
            to="/ayarlar"
            aria-label={t('nav.settings')}
            className={cn(
              'flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground',
              pathname.startsWith('/ayarlar') && 'font-medium text-primary',
            )}
          >
            <Avatar className="size-5">
              <AvatarImage src={avatarSrc(user.avatarPath)} alt="" />
              <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
            </Avatar>
            {t('nav.settings')}
          </NavLink>
        </nav>
      </SidebarInset>
    </SidebarProvider>
  )
}
