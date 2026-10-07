import { HttpError, readBody, requireDate, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import { createMemberAccounts } from '../_shared/accounts.ts'

// Yanlış kod denemesi sınırı: kullanıcı başına 15 dakikada 5.
const MAX_FAILS = 5

const INVALID_CODE = new HttpError(404, 'Kod geçersiz veya süresi dolmuş', 'invalid_code')

// Davet koduyla gruba katıl. Para birimi grubun para birimidir.
serve(async (req, user) => {
  const body = await readBody(req)
  const code = requireString(body.code, 'code', 16).toUpperCase()
  const first = requireString(body.first_name, 'first_name')
  const last = requireString(body.last_name, 'last_name')
  const birth = requireDate(body.birth_date, 'birth_date')

  const [{ fails }] = await sql`
    select count(*)::int as fails from invite_attempts
    where user_id = ${user.id} and at > now() - interval '15 minutes'`
  if (fails >= MAX_FAILS) throw new HttpError(429, 'Çok fazla yanlış deneme, biraz bekle', 'too_many_attempts')

  const memberId = uuidv7()

  const groupId = await sql.begin(async (tx) => {
    await setActor(tx, memberId)
    // Kod yanlış/süresi dolmuş/iptal/limit dolu: hepsi aynı hata (kod tahminini zorlaştırır).
    const [invite] = await tx`
      select i.id, i.group_id, g.base_currency
      from group_invites i join groups g on g.id = i.group_id
      where i.code = ${code} and i.revoked_at is null and i.expires_at > now()
        and (i.max_uses is null or i.use_count < i.max_uses)
      for update of i`
    if (!invite) throw INVALID_CODE

    const updated = await tx`
      update profiles set first_name = ${first}, last_name = ${last}, birth_date = ${birth}
      where id = ${user.id} returning id`
    if (updated.length === 0) throw new Error('profile row missing for user ' + user.id)

    await tx`insert into members (id, group_id, user_id, role) values (${memberId}, ${invite.group_id}, ${user.id}, 'member')`
    await createMemberAccounts(tx, invite.group_id, memberId, invite.base_currency)
    await tx`update group_invites set use_count = use_count + 1 where id = ${invite.id}`
    return invite.group_id as string
  }).catch(async (err) => {
    // Başarısız denemeyi transaction dışında kaydet (rollback'ten etkilenmesin).
    if (err === INVALID_CODE) await sql`insert into invite_attempts (user_id) values (${user.id})`
    throw err
  })

  return { group_id: groupId, member_id: memberId }
}, 201)
