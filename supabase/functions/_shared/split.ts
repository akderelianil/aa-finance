import type { Tx } from './db.ts'
import { HttpError, requireString } from './http.ts'
import { findOrCreateContact, parseAmount, resolveDebtAccount, type RawLine } from './entries.ts'

// Paylaştır: gideri ben ödedim, diğer kişiler payları kadar bana borçlu.
// Kişi başına: tutar ("185.78"), yüzde ("20") ya da boş. Boş olanlar ve ben kalanı eşit böleriz;
// bölünmeyen kuruş bende kalır. Benim payım 0 olabilir (tamamını başkası için ödedim).
export type SplitPerson = { name: string; amount?: string; percent?: string }

export function parseSplit(v: unknown): SplitPerson[] | null {
  if (v === undefined || v === null) return null
  if (!Array.isArray(v) || v.length === 0 || v.length > 20) throw new HttpError(422, 'split geçersiz', 'invalid_split')
  return v.map((p) => {
    if (typeof p !== 'object' || p === null) throw new HttpError(422, 'split geçersiz', 'invalid_split')
    const r = p as Record<string, unknown>
    const name = requireString(r.name, 'split.name', 100)
    const amount = typeof r.amount === 'string' && r.amount.trim() ? r.amount.trim() : undefined
    const percent = typeof r.percent === 'string' && r.percent.trim() ? r.percent.trim() : undefined
    if (amount && percent) throw new HttpError(422, 'split geçersiz', 'invalid_split')
    if (percent && !/^\d{1,3}([.,]\d{1,2})?$/.test(percent)) throw new HttpError(422, 'split geçersiz', 'invalid_split')
    return { name, amount, percent: percent?.replace(',', '.') }
  })
}

// Toplamı paylara böler: { mine, others[i] } (minor unit).
export function splitShares(total: bigint, people: SplitPerson[], exponent: number) {
  const fixed = people.map((p) => {
    if (p.amount) return parseAmount(p.amount, exponent)
    if (p.percent) return (total * BigInt(Math.round(Number(p.percent) * 100))) / 10000n
    return null
  })
  const rest = total - fixed.reduce<bigint>((s, a) => s + (a ?? 0n), 0n)
  if (rest < 0n) throw new HttpError(422, 'Paylar toplamı tutarı aşıyor', 'split_exceeds_total')
  const blanks = BigInt(fixed.filter((a) => a === null).length)
  const each = rest / (blanks + 1n)
  const others = fixed.map((a) => a ?? each)
  const mine = total - others.reduce((s, a) => s + a, 0n)
  if (others.some((a) => a <= 0n)) throw new HttpError(422, 'Pay sıfır olamaz', 'invalid_split')
  return { mine, others }
}

// Gider satırını (Borç kategori) paylaşımlı satırlarla değiştirir: Borç kategori (benim payım) + Borç alacak (kişi başı).
export async function splitDebitLines(
  tx: Tx,
  m: { group_id: string; member_id: string; base_currency: string; exponent: number },
  categoryId: string,
  total: bigint,
  people: SplitPerson[],
): Promise<RawLine[]> {
  const { mine, others } = splitShares(total, people, m.exponent)
  const receivable = await resolveDebtAccount(tx, m, 'receivable')
  const cur = m.base_currency
  const lines: RawLine[] = []
  if (mine > 0n) lines.push({ account: categoryId, dir: 'debit', amount: mine, currency: cur, base: mine })
  for (const [i, p] of people.entries()) {
    const contactId = await findOrCreateContact(tx, m.group_id, p.name)
    lines.push({ account: receivable, dir: 'debit', amount: others[i], currency: cur, base: others[i], contactId })
  }
  return lines
}
