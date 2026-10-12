import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { parseAccountFields } from '../_shared/accounts.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import { loadMember } from '../_shared/entries.ts'

// New account in the group Chart of Accounts (GnuCash "New Account"). Any member can add one.
// Request: { name, parent_id?, type? (required without parent), code?, currency?, subtype?, owner_member_id?,
//            is_placeholder? }
// A child takes the parent type. Missing currency = parent currency, else base currency. Missing code = next free
// child code; missing parent = default group of the type (trigger accounts_defaults).
// Opening balances are journal entries against 3.01 Açılış Bakiyesi (Özkaynak).
const TYPES = ['asset', 'liability', 'equity', 'income', 'expense']

serve(async (req, user) => {
  const body = await readBody(req)
  const name = requireString(body.name, 'name', 80)
  const id = uuidv7()

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)

    let parent: { id: string; type: string; currency: string } | undefined
    if (body.parent_id !== undefined && body.parent_id !== null) {
      if (typeof body.parent_id !== 'string') throw new HttpError(422, 'parent_id geçersiz', 'invalid_parent')
      ;[parent] = await tx`
        select id, type, currency from accounts
        where id = ${body.parent_id} and group_id = ${m.group_id} and system_key is null and archived_at is null
        for update`
      if (!parent) throw new HttpError(422, 'Üst hesap geçersiz', 'invalid_parent')
    }
    const type = parent?.type ?? (typeof body.type === 'string' ? body.type : '')
    if (!TYPES.includes(type) || (parent && body.type !== undefined && body.type !== type)) {
      throw new HttpError(422, 'type geçersiz', 'invalid_type')
    }
    const f = await parseAccountFields(tx, m.group_id, type, body)
    const currency = f.currency ?? parent?.currency ?? m.base_currency

    await tx`
      insert into accounts (id, group_id, owner_member_id, parent_id, type, subtype, code, name, currency, is_placeholder)
      values (${id}, ${m.group_id}, ${f.owner ?? null}, ${parent?.id ?? null}, ${type}, ${f.subtype ?? null},
              ${f.code ?? null}, ${name}, ${currency}, ${body.is_placeholder === true})`
  })

  return { account_id: id }
}, 201)
