import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/** "TRY · Türk Lirası": the code and its name in the UI language (falls back to the stored name). */
export function useCurrencyLabel() {
  const { i18n } = useTranslation()
  return useCallback((c: { code: string; name: string }) => {
    let name = c.name
    try { name = new Intl.DisplayNames([i18n.language], { type: 'currency' }).of(c.code) ?? c.name } catch { /* unknown code */ }
    return `${c.code} · ${name}`
  }, [i18n.language])
}
