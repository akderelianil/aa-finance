import { useTranslation } from 'react-i18next'
import type { Membership } from '@/auth/useMembership'
import { RecentEntries } from '@/components/RecentEntries'
import { exponentOf } from '@/lib/money'

export default function Journal({ membership }: { membership: Membership }) {
  const { t } = useTranslation()
  return (
    <>
      <h1 className="text-2xl font-semibold">{t('journal.title')}</h1>
      <RecentEntries membership={membership} exponent={exponentOf(membership.group.base_currency)} />
    </>
  )
}
