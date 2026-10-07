// Gösterim amaçlı: minor unit → para birimi biçimli metin. Hesaplama için kullanılmaz.
export function exponentOf(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
}

export function formatMinor(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 10 ** exponentOf(currency))
}
