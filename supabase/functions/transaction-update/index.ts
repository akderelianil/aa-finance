import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import {
  assertNotLocked, entryDate, findOrCreateCategory, findOrCreateContact, insertLines, loadMember, loadOwnedEntry,
  parseAmount, parseItems, parseTags, setEntryTags, withRest, type Part,
} from '../_shared/entries.ts'

// Hızlı kayıtla girilmiş gider/gelir kaydını düzenler: ana para biriminde, tek hesap satırı + bir ya da
// çok kategori satırı (kalemler). Verilmeyen alanlar değişmez; contact_name boş string = kişiyi kaldır,
// items boş dizi = kalemleri kaldır, tags verilirse etiketler bu listeyle değişir.
// Tutar/kategori/kalem değişince satırlar yeniden yazılır.
serve(async (req, user) => {
  const body = await readBody(req)
  const tags = body.tags === undefined ? undefined : parseTags(body.tags)

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const entry = await loadOwnedEntry(tx, body.entry_id, m)

    const [src] = await tx`select source_type from journal_entries where id = ${entry.id}`
    const lines = await tx`
      select l.account_id, l.contact_id, l.direction, l.amount, l.currency, a.type, a.system_key
      from journal_lines l join accounts a on a.id = l.account_id
      where l.entry_id = ${entry.id} order by l.position`
    const cats = lines.filter((l) => l.type === 'income' || l.type === 'expense')
    const acct = lines.filter((l) => l.type === 'asset' || l.type === 'liability')
    const kind = cats[0]?.type as string
    if (src.source_type || acct.length !== 1 || cats.length !== lines.length - 1 || !kind
        || cats.some((l) => l.type !== kind || l.system_key) || lines.some((l) => l.currency !== m.base_currency)) {
      throw new HttpError(422, 'Bu kayıt türü henüz düzenlenemiyor', 'unsupported_entry')
    }

    if (body.date !== undefined) {
      const date = entryDate(body.date)
      assertNotLocked(m.lock_date, date)
      await tx`update journal_entries set entry_date = ${date} where id = ${entry.id}`
    }
    const description = body.description === undefined ? undefined
      : body.description ? requireString(body.description, 'description', 200) : ''
    await tx`
      update journal_entries set updated_at = now(), description = coalesce(${description ?? null}, description)
      where id = ${entry.id}`
    if (tags) await setEntryTags(tx, m.group_id, entry.id, tags)

    const contactId = body.contact_name === undefined ? cats[0].contact_id as string | null
      : body.contact_name
        ? await findOrCreateContact(tx, m.group_id, requireString(body.contact_name, 'contact_name', 100), 'brand')
        : null
    const total = body.amount !== undefined ? parseAmount(body.amount, m.exponent) : BigInt(acct[0].amount)
    const main = body.category_name !== undefined
      ? await findOrCreateCategory(tx, m.group_id, kind, requireString(body.category_name, 'category_name', 60))
      : cats[0].account_id as string
    const parts: Part[] = body.items !== undefined
      ? await parseItems(tx, m.group_id, kind, body.items, m.exponent)
      : cats.slice(1).map((l) => ({ account: l.account_id, amount: BigInt(l.amount) }))

    const dir = kind === 'expense' ? 'debit' : 'credit'
    const cur = m.base_currency
    await tx`delete from journal_lines where entry_id = ${entry.id}`
    await insertLines(tx, entry.id, [
      ...withRest(main, total, parts).map((p) => ({ account: p.account, dir, amount: p.amount, currency: cur, base: p.amount, contactId })),
      { account: acct[0].account_id, dir: dir === 'debit' ? 'credit' : 'debit', amount: total, currency: cur, base: total, contactId },
    ])
  })

  return { ok: true }
})
