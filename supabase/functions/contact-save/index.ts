import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { loadMember } from '../_shared/entries.ts'
import { uuidv7 } from '../_shared/uuid.ts'

// Rehber kaydı ekle / düzenle. Rehber grup ortaktır: her üye düzenler.
// Alanlar: name, kind (individual | brand | business), phone, email, tax_id,
// default_category_id (yalnız marka; gider/gelir kategorisi), links (marka ↔ firma, karşı tarafın id'leri),
// bank_accounts [{ bank_name?, iban }] (verilirse listenin tamamı yenisiyle değişir).
const KINDS = ['individual', 'brand', 'business']

const optional = (v: unknown, field: string, max: number) =>
  v === undefined || v === null || v === '' ? null : requireString(v, field, max)

serve(async (req, user) => {
  const body = await readBody(req)
  const id = typeof body.id === 'string' ? body.id : null
  const name = requireString(body.name, 'name', 100)
  const kind = typeof body.kind === 'string' ? body.kind : 'individual'
  if (!KINDS.includes(kind)) throw new HttpError(422, 'kind geçersiz', 'invalid_kind')
  const phone = optional(body.phone, 'phone', 40)
  const email = optional(body.email, 'email', 120)
  const taxId = optional(body.tax_id, 'tax_id', 20)
  const categoryId = kind === 'brand' ? optional(body.default_category_id, 'default_category_id', 40) : null
  const links = Array.isArray(body.links) ? body.links.filter((x): x is string => typeof x === 'string') : null
  const banks = Array.isArray(body.bank_accounts)
    ? body.bank_accounts.map((b) => {
        const r = (b ?? {}) as Record<string, unknown>
        const iban = requireString(r.iban, 'iban', 40).replace(/\s+/g, '').toUpperCase()
        if (iban.length < 10) throw new HttpError(422, 'IBAN geçersiz', 'invalid_iban')
        return { bank_name: optional(r.bank_name, 'bank_name', 60), iban }
      })
    : null

  const contactId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)

    const [dup] = await tx`
      select id from contacts where group_id = ${m.group_id} and archived_at is null
        and lower(name) = lower(${name}) and id is distinct from ${id}`
    if (dup) throw new HttpError(409, 'Bu isim Rehber\'de var', 'duplicate_name')

    if (categoryId) {
      const [cat] = await tx`
        select 1 from accounts where id = ${categoryId} and group_id = ${m.group_id}
          and type in ('expense', 'income') and system_key is null and archived_at is null`
      if (!cat) throw new HttpError(422, 'Kategori geçersiz', 'invalid_category')
    }

    let cid = id
    if (cid) {
      const [c] = await tx`select id from contacts where id = ${cid} and group_id = ${m.group_id} for update`
      if (!c) throw new HttpError(404, 'Kayıt bulunamadı', 'not_found')
      await tx`
        update contacts set name = ${name}, kind = ${kind}, phone = ${phone}, email = ${email}, tax_id = ${taxId},
          default_category_id = ${categoryId}
        where id = ${cid}`
    } else {
      cid = uuidv7()
      await tx`
        insert into contacts (id, group_id, kind, name, phone, email, tax_id, default_category_id)
        values (${cid}, ${m.group_id}, ${kind}, ${name}, ${phone}, ${email}, ${taxId}, ${categoryId})`
    }

    // Tür değiştiyse geçersiz kalan bağlar silinir; links verildiyse yeniden kurulur.
    if (kind === 'individual' || links) {
      await tx`delete from brand_businesses where brand_id = ${cid} or business_id = ${cid}`
    }
    if (links && kind !== 'individual') {
      const otherKind = kind === 'brand' ? 'business' : 'brand'
      for (const other of new Set(links)) {
        const [o] = await tx`
          select id from contacts where id = ${other} and group_id = ${m.group_id} and kind = ${otherKind} and archived_at is null`
        if (!o) throw new HttpError(422, 'Bağlantı geçersiz', 'invalid_link')
        const [brand, business] = kind === 'brand' ? [cid, other] : [other, cid]
        await tx`insert into brand_businesses (group_id, brand_id, business_id) values (${m.group_id}, ${brand}, ${business})`
      }
    }

    if (banks) {
      await tx`delete from contact_bank_accounts where contact_id = ${cid}`
      for (const b of banks) {
        await tx`
          insert into contact_bank_accounts (id, group_id, contact_id, bank_name, iban)
          values (${uuidv7()}, ${m.group_id}, ${cid}, ${b.bank_name}, ${b.iban})`
      }
    }
    return cid
  })

  return { contact_id: contactId }
})
