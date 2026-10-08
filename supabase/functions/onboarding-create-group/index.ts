import { HttpError, readBody, requireDate, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import { applyAccountTemplate, createGroupSystemAccounts, createMemberAccounts } from '../_shared/accounts.ts'

// Aile/Grup kur: profil bilgileri + grup + kurucu (admin) + sistem hesapları + hesap şablonu, tek transaction.
serve(async (req, user) => {
  const body = await readBody(req)
  const first = requireString(body.first_name, 'first_name')
  const last = requireString(body.last_name, 'last_name')
  const birth = requireDate(body.birth_date, 'birth_date')
  const currency = requireString(body.base_currency, 'base_currency', 3).toUpperCase()
  const groupName = body.group_name ? requireString(body.group_name, 'group_name', 100) : `${last} Ailesi`

  const groupId = uuidv7()
  const memberId = uuidv7()

  await sql.begin(async (tx) => {
    await setActor(tx, memberId)
    const [cur] = await tx`select 1 from currencies where code = ${currency}`
    if (!cur) throw new HttpError(422, 'Desteklenmeyen para birimi', 'invalid_base_currency')

    const updated = await tx`
      update profiles set first_name = ${first}, last_name = ${last}, birth_date = ${birth}
      where id = ${user.id} returning id`
    if (updated.length === 0) throw new Error('profile row missing for user ' + user.id)

    await tx`insert into groups (id, name, base_currency) values (${groupId}, ${groupName}, ${currency})`
    await tx`insert into members (id, group_id, user_id, role) values (${memberId}, ${groupId}, ${user.id}, 'admin')`
    // Template first: system and member accounts go under its groups (trigger accounts_defaults).
    await applyAccountTemplate(tx, groupId)
    await createGroupSystemAccounts(tx, groupId)
    await createMemberAccounts(tx, groupId, memberId, currency)
  })

  return { group_id: groupId, member_id: memberId }
}, 201)
