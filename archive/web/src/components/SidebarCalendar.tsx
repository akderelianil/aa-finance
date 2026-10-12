import { enUS, tr } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { YearCalendar } from '@/components/YearCalendar'
import { SidebarGroup, SidebarGroupContent, useSidebar } from '@/components/ui/sidebar'

// Month view with year/month picker. Hidden when the sidebar is collapsed to icons.
export function SidebarCalendar() {
  const { i18n } = useTranslation()
  const { state } = useSidebar()
  if (state === 'collapsed') return null
  const locale = i18n.resolvedLanguage === 'en' ? enUS : tr
  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupContent className="p-0">
        <YearCalendar locale={locale} />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
