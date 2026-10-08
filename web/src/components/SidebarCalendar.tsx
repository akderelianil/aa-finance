import { getISOWeek } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { Calendar } from '@/components/ui/calendar'
import { SidebarGroup, SidebarGroupContent, useSidebar } from '@/components/ui/sidebar'

// Display-only month view: today's date, weekday and ISO week. Hidden when the sidebar is collapsed to icons.
export function SidebarCalendar() {
  const { t, i18n } = useTranslation()
  const { state } = useSidebar()
  if (state === 'collapsed') return null
  const today = new Date()
  const locale = i18n.resolvedLanguage === 'en' ? enUS : tr
  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupContent>
        <div className="flex flex-col gap-1 px-2 pb-1">
          <p className="text-sm font-medium">{today.toLocaleDateString(locale.code, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="text-xs text-muted-foreground">
            {today.toLocaleDateString(locale.code, { weekday: 'long' })} · {t('calendar.week', { n: getISOWeek(today) })}
          </p>
        </div>
        <Calendar
          mode="single" selected={today} month={today} locale={locale} weekStartsOn={1} showWeekNumber
          hideNavigation disabled className="w-full p-0 [--cell-size:--spacing(8)]"
        />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
