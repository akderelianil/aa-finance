import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import { loadMember, parseAmount, postRawEntry } from '../_shared/entries.ts'
import { exponentOf, parseRate, resolveRate, saveRate, toBase } from '../_shared/fx.ts'

// Kullanıcının kendi hesabı: nakit, banka, kredi kartı, kredi/borç; ya da grup geneli gelir/gider kategorisi (type).
// parent_id (opsiyonel): alt hesap; tip, sahip, para birimi ve (verilmezse) alt tür üstten türetilir.
// Para birimi varsayılan grubun ana para birimi; döviz hesabında başlangıç bakiyesi için kur (verilmezse son kur) gerekir.
// Başlangıç bakiyesi (kartta: mevcut borç) opsiyonel.
const SUBTYPES: Record<string, 'asset' | 'liability'> = {
  cash: 'asset', bank: 'asset', credit_card: 'liability', loan: 'liability',
}

serve(async (req, user) => {
  const body = await readBody(req)
  const name = requireString(body.name, 'name', 60)
  if (body.parent_id !== undefined && body.parent_id !== null && typeof body.parent_id !== 'string') {
    throw new HttpError(422, 'parent_id geçersiz', 'invalid_parent')
  }
  const parentId = (body.parent_id as string | null | undefined) ?? null
  const kind = typeof body.type === 'string' ? body.type : ''
  if (kind && kind !== 'income' && kind !== 'expense') throw new HttpError(422, 'type geçersiz', 'invalid_type')

  const id = uuidv7()

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)

    let parent: {
      type: string; subtype: string | null; owner_member_id: string | null; currency: string | null
      archived_at: Date | null; system_key: string | null
    } | undefined
    if (parentId) {
      ;[parent] = await tx`
        select type, subtype, owner_member_id, currency, archived_at, system_key from accounts
        where id = ${parentId} and group_id = ${m.group_id} for update`
      if (!parent) throw new HttpError(404, 'Üst hesap bulunamadı', 'not_found')
      if (parent.system_key) throw new HttpError(422, 'Sistem hesabı değiştirilemez', 'system_account')
      if (parent.archived_at) throw new HttpError(422, 'Üst hesap arşivde', 'parent_archived')
    }

    // Kategori (gelir/gider): grup geneli, sahip ve para birimi yok.
    const catType = parent ? (parent.type === 'income' || parent.type === 'expense' ? parent.type : '') : kind
    if (catType) {
      await tx`
        insert into accounts (id, group_id, parent_id, type, name)
        values (${id}, ${m.group_id}, ${parentId}, ${catType}, ${name})`
      return
    }

    if (parent && parent.owner_member_id !== m.member_id) {
      throw new HttpError(403, 'Bu hesabı sadece sahibi değiştirebilir', 'not_owner')
    }
    const subtype = typeof body.subtype === 'string' ? body.subtype : (parent?.subtype ?? '')
    const type = SUBTYPES[subtype]
    if (!type || (parent && parent.type !== type)) throw new HttpError(422, 'subtype geçersiz', 'invalid_subtype')
    const currency = parent?.currency
      ?? (body.currency ? requireString(body.currency, 'currency', 3).toUpperCase() : m.base_currency)
    if (parent && body.currency && String(body.currency).toUpperCase() !== currency) {
      throw new HttpError(422, 'Alt hesap üstle aynı para biriminde olmalı', 'invalid_currency')
    }
    const exp = await exponentOf(tx, currency)

    await tx`
      insert into accounts (id, group_id, owner_member_id, parent_id, type, subtype, name, currency)
      values (${id}, ${m.group_id}, ${m.member_id}, ${parentId}, ${type}, ${subtype}, ${name}, ${currency})`

    if (body.opening_balance !== undefined && body.opening_balance !== '' && body.opening_balance !== null) {
      const amount = parseAmount(body.opening_balance, exp)
      let base = amount
      let rate: string | undefined
      if (currency !== m.base_currency) {
        const given = parseRate(body.rate)
        rate = await resolveRate(tx, m.group_id, currency, m.base_currency, given)
        base = await toBase(tx, amount, exp, m.exponent, rate)
        if (given) await saveRate(tx, m.group_id, currency, m.base_currency, new Date().toISOString().slice(0, 10), given)
      }
      const [eq] = await tx`
        select id from accounts
        where group_id = ${m.group_id} and owner_member_id = ${m.member_id} and system_key = 'opening_balance'
        for update`
      if (!eq) throw new Error('opening_balance account missing for member ' + m.member_id)
      // Varlık: Borç hesap / Alacak açılış. Borç hesabı: Borç açılış / Alacak hesap.
      const acct = { amount, currency, base, rate }
      const eqLine = { amount: base, currency: m.base_currency, base }
      await postRawEntry(tx, m, {
        date: new Date().toISOString().slice(0, 10), description: name, sourceType: 'opening_balance',
        lines: type === 'asset'
          ? [{ account: id, dir: 'debit', ...acct }, { account: eq.id, dir: 'credit', ...eqLine }]
          : [{ account: eq.id, dir: 'debit', ...eqLine }, { account: id, dir: 'credit', ...acct }],
      })
    }
  })

  return { account_id: id }
}, 201)
