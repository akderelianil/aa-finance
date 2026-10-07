import { ReceiptTextIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { PageHeader } from '@/components/PageHeader'
import { RecentEntries } from '@/components/RecentEntries'
import { exponentOf } from '@/lib/money'

export default function Journal({ membership }: { membership: Membership }) {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('journal.title')} description={t('journal.subtitle')} icon={ReceiptTextIcon} />
      <RecentEntries membership={membership} exponent={exponentOf(membership.group.base_currency)} />
    </>
  )
}
