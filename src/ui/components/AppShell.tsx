import { ArrowRightLeftIcon, BookOpenIcon, ChartPieIcon, HistoryIcon, ListTreeIcon, PlusIcon, SettingsIcon } from 'lucide-react'
import { Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger,
} from '@/components/ui/sidebar'
import { EntryDialog } from './journal/EntryDialog'
import { newDraft, type Draft } from './journal/JournalEditor'
import { QuickEntryDialog } from './quick/QuickEntryDialog'
import { ThemeToggle } from './ThemeToggle'

const ITEMS = [
  { to: '/hesaplar', key: 'accounts', icon: ListTreeIcon },
  { to: '/yevmiye', key: 'journal', icon: BookOpenIcon },
  { to: '/raporlar', key: 'reports', icon: ChartPieIcon },
  { to: '/kurlar', key: 'rates', icon: ArrowRightLeftIcon },
] as const

const active = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`)

// Desktop only (v1): left sidebar, page on the right.
export function AppShell() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [quick, setQuick] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={t('nav.quick')}
                    onClick={() => setQuick(true)}
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
                {ITEMS.map(({ to, key, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton tooltip={t(`nav.${key}`)} isActive={active(pathname, to)} render={<NavLink to={to} />}>
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
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={t('nav.activity')} isActive={active(pathname, '/etkinlik')} render={<NavLink to="/etkinlik" />}>
                <HistoryIcon />
                <span>{t('nav.activity')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={t('nav.settings')} isActive={active(pathname, '/ayarlar')} render={<NavLink to="/ayarlar" />}>
                <SettingsIcon />
                <span>{t('nav.settings')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger aria-label={t('nav.toggle')} />
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <div className="flex w-full flex-col gap-4 px-6 pt-4 pb-8">
          <Suspense><Outlet /></Suspense>
        </div>
      </SidebarInset>
      <QuickEntryDialog open={quick} onClose={() => setQuick(false)} onFree={() => setDraft(newDraft())} />
      <EntryDialog draft={draft} onChange={setDraft} onClose={() => setDraft(null)} />
    </SidebarProvider>
  )
}
