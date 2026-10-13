// Number and date format follow the book's country; the UI language only picks the words.
// Dates are numeric so the month name never mixes languages.
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useOp } from './api'
import { formatLocale } from './locale'

const day = { day: '2-digit', month: '2-digit', year: 'numeric' } as const

export function useFormat() {
  const { i18n } = useTranslation()
  const country = useOp('settings.get', {}).data?.country
  const locale = formatLocale(country, i18n.language)
  // Stable functions: grids rebuild their columns when these change.
  return useMemo(() => ({
    locale,
    /** "2026-10-12" → "12.10.2026". */
    date: (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, day),
    /** Epoch ms → date and time. */
    dateTime: (ms: number, seconds = false) =>
      new Date(ms).toLocaleString(locale, { ...day, hour: '2-digit', minute: '2-digit', ...(seconds && { second: '2-digit' }) }),
  }), [locale])
}
