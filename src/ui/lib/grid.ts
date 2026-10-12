import { functionalUpdate, type PaginationState, type Updater } from '@tanstack/react-table'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DataGridI18nOverrides } from '@/components/reui/data-grid/data-grid-i18n'

export const PAGE_SIZES = [25, 50, 100]

/**
 * SQL paging for a grid (`manualPagination`): the hook owns page and size; a new `key` (the filters) goes
 * back to the first page. `start: 'last'` opens on the last page once `count` is known (a register read
 * oldest first). While the first page loads the grid draws 10 skeleton rows.
 */
export function useServerPages(key: string, count: number | undefined, start: 'first' | 'last' = 'first') {
  const [state, setState] = useState<{ key: string; index: number | null; size: number }>({ key, index: null, size: 50 })
  const last = Math.max(0, Math.ceil((count ?? 0) / state.size) - 1)
  const index = state.key === key && state.index !== null ? state.index : start === 'last' ? last : 0
  const pagination: PaginationState = { pageIndex: index, pageSize: count === undefined ? 10 : state.size }
  const onPaginationChange = (u: Updater<PaginationState>) => {
    const p = functionalUpdate(u, pagination)
    setState({ key, index: p.pageSize !== state.size ? 0 : p.pageIndex, size: p.pageSize })
  }
  // The query asks for this page. Before `count` is known with start 'last', it waits (page null).
  const page = start === 'last' && count === undefined && !(state.key === key && state.index !== null) ? null : index
  return { pagination, onPaginationChange, page, pageSize: state.size }
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
