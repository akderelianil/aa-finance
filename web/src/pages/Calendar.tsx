import { CalendarIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

export default function Calendar() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('nav.calendar')} />
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><CalendarIcon /></EmptyMedia>
          <EmptyTitle>{t('calendar.empty')}</EmptyTitle>
          <EmptyDescription>{t('calendar.hint')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </>
  )
}
