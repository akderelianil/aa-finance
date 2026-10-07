import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import {
  assertNotLocked, entryDate, findOrCreateCategory, findOrCreateContact, loadMember, loadOwnedEntry, parseAmount,
} from '../_shared/entries.ts'

// Hızlı kayıtla girilmiş (2 satırlı, ana para birimli) gider/gelir kaydını düzenler.
// Verilmeyen alanlar değişmez; contact_name boş string = kişiyi kaldır.
serve(async (req, user) => {
  const body = await readBody(req)

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const entry = await loadOwnedEntry(tx, body.entry_id, m)

    const [src] = await tx`select source_type from journal_entries where id = ${entry.id}`
    if (src.source_type) throw new HttpError(422, 'Bu kayıt türü henüz düzenlenemiyor', 'unsupported_entry')

    const lines = await tx`
      select l.id, l.account_id, l.currency, a.type as account_type
      from journal_lines l join accounts a on a.id = l.account_id
      where l.entry_id = ${entry.id} order by l.position`
    const catLine = lines.find((l) => l.account_type === 'income' || l.account_type === 'expense')
    if (lines.length !== 2 || !catLine || lines.some((l) => l.currency !== m.base_currency)) {
      throw new HttpError(422, 'Bu kayıt türü henüz düzenlenemiyor', 'unsupported_entry')
    }

    if (body.date !== undefined) {
      const date = entryDate(body.date)
      assertNotLocked(m.lock_date, date)
      await tx`update journal_entries set entry_date = ${date} where id = ${entry.id}`
    }
    if (body.description !== undefined) {
      const d = body.description ? requireString(body.description, 'description', 200) : ''
      await tx`update journal_entries set description = ${d} where id = ${entry.id}`
    }
    if (body.amount !== undefined) {
      const a = parseAmount(body.amount, m.exponent).toString()
      await tx`update journal_lines set amount = ${a}, base_amount = ${a} where entry_id = ${entry.id}`
    }
    if (body.category_name !== undefined) {
      const name = requireString(body.category_name, 'category_name', 60)
      const catId = await findOrCreateCategory(tx, m.group_id, catLine.account_type, name)
      await tx`update journal_lines set account_id = ${catId} where id = ${catLine.id}`
    }
    if (body.contact_name !== undefined) {
      const contactId = body.contact_name
        ? await findOrCreateContact(tx, m.group_id, requireString(body.contact_name, 'contact_name', 100))
        : null
      await tx`update journal_lines set contact_id = ${contactId} where entry_id = ${entry.id}`
    }
    await tx`update journal_entries set updated_at = now() where id = ${entry.id}`
  })

  return { ok: true }
})
