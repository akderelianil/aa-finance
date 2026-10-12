import { HttpError, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'

// 0/O ve 1/I hariç 32 karakter; group_invites.code CHECK kısıtıyla aynı küme.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => ALPHABET[b % 32]).join('')
}

// Davet kodu üret (yalnızca grup admini). Varsayılan: 7 gün, sınırsız kullanım.
serve(async (req, user) => {
  // Gövde opsiyonel: boş istek varsayılanları kullanır.
  const body = await req.json().catch(() => ({}))
  const days = body.expires_in_days === undefined ? 7 : Number(body.expires_in_days)
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    throw new HttpError(422, 'Geçerlilik 1-30 gün olmalı', 'invalid_expires_in_days')
  }

  return await sql.begin(async (tx) => {
    const [member] = await tx`select id, group_id, role from members where user_id = ${user.id}`
    if (!member) throw new HttpError(403, 'Bir gruba üye değilsin', 'no_group')
    if (member.role !== 'admin') throw new HttpError(403, 'Sadece grup yöneticisi davet kodu üretebilir', 'not_admin')
    await setActor(tx, member.id)

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode()
      const [inserted] = await tx`
        insert into group_invites (id, group_id, code, created_by, expires_at)
        values (${uuidv7()}, ${member.group_id}, ${code}, ${member.id}, now() + make_interval(days => ${days}))
        on conflict (code) do nothing
        returning code, expires_at`
      if (inserted) return { code: inserted.code, expires_at: inserted.expires_at }
    }
    throw new Error('could not generate unique invite code')
  })
}, 201)
