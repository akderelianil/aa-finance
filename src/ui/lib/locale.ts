// The locale that drives number and date format: the book country's own, else the UI language. Pure, so it is unit tested.

/** The country's own locale (TR → tr-Latn-TR); the UI language when no country is set or the region is not valid. */
export const formatLocale = (country: string | null | undefined, language: string): string => {
  if (!country) return language
  try {
    return new Intl.Locale('und', { region: country }).maximize().toString()
  } catch {
    return language
  }
}
