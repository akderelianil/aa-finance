import { HttpError } from './http.ts'

// Vadeli hesap yardımcıları: oran/gün/stopaj doğrulama, vade tarihi.
export function parseRatePercent(v: unknown, field: string, max = 1000): string {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim().replace(',', '.') : ''
  if (!/^\d{1,4}(\.\d{1,4})?$/.test(s) || Number(s) > max) throw new HttpError(422, `${field} geçersiz`, 'invalid_rate')
  return s
}

export function parseDays(v: unknown): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1 || n > 3660) throw new HttpError(422, 'days geçersiz', 'invalid_days')
  return n
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
