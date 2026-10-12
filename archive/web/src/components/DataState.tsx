import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

type Props = {
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  /** Shown when there is no data: title, optional hint and an action. */
  empty?: { title: string; hint?: string; action?: ReactNode }
  /** Placeholder rows while loading. */
  rows?: number
}

// One loading / error / empty block for every data region outside a data-grid.
// Returns null when the region has data: render it before your content and
// check `loading || error || isEmpty` yourself, or pass `empty` only when empty.
export function DataState({ loading, error, onRetry, empty, rows = 4 }: Props) {
  const { t } = useTranslation()
  if (loading) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-busy="true">
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    )
  }
  if (error) {
    return (
      <Empty>
        <EmptyHeader><EmptyTitle>{t('state.error')}</EmptyTitle></EmptyHeader>
        {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{t('state.retry')}</Button>}
      </Empty>
    )
  }
  if (!empty) return null
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{empty.title}</EmptyTitle>
        {empty.hint && <EmptyDescription>{empty.hint}</EmptyDescription>}
      </EmptyHeader>
      {empty.action}
    </Empty>
  )
}
