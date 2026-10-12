import { functionalUpdate, type PaginationState, type Updater } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DataGridI18nOverrides } from '@/components/reui/data-grid/data-grid-i18n'

export const PAGE_SIZES = [25, 50, 100]

/**
 * Client-side pages for a long grid (all rows are loaded; only one page renders). A new `key` (the filters)
 * goes back to the start page: the first, or the last for a register read oldest first. While loading the
 * grid draws one skeleton row per pageSize row, so the size is 10 then. The table sets
 * `autoResetPageIndex: false`: this hook owns the page.
 */
export function useGridPages(count: number, key: string, loading: boolean, start: 'first' | 'last' = 'first') {
  const [page, setPage] = useState<{ key: string; index: number | null; size: number }>({ key, index: null, size: 50 })
  const last = Math.max(0, Math.ceil(count / page.size) - 1)
  const startIndex = start === 'last' ? last : 0
  const pagination: PaginationState = loading
    ? { pageIndex: 0, pageSize: 10 }
    : { pageIndex: page.key === key && page.index !== null ? Math.min(page.index, last) : startIndex, pageSize: page.size }
  const onPaginationChange = (u: Updater<PaginationState>) => {
    if (loading) return
    const p = functionalUpdate(u, pagination)
    setPage({ key, index: p.pageIndex, size: p.pageSize })
  }
  return { pagination, onPaginationChange }
}

/** Pagination labels of the ReUI data grid in the app language. */
export function useGridI18n(): DataGridI18nOverrides {
  const { t } = useTranslation()
  return {
    labels: {
      rowsPerPage: t('grid.rowsPerPage'),
      paginationInfo: ({ from, to, count }) => t('grid.info', { from, to, count }),
      previousPage: t('grid.previous'),
      nextPage: t('grid.next'),
      goToPage: (page) => t('grid.goTo', { page }),
    },
  }
}
