import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { loadMember } from '../_shared/entries.ts'

// Yaklaşanlar satırı: ertele (yeni tarih) ya da vazgeç (listeden kaldır). Plan yalnız sahibinindir.
// Plan kayıt değildir; bu işlem para hareketi yazmaz.
serve(async (req, user) => {
  const body = await readBody(req)
  if (typeof body.id !== 'string') throw new HttpError(422, 'id geçersiz', 'not_found')
  const action = body.action
  if (action !== 'postpone' && action !== 'dismiss') throw new HttpError(422, 'action geçersiz', 'invalid_action')
  const due = body.due_date
  if (action === 'postpone' && !(typeof due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(due)
    && !isNaN(new Date(due + 'T00:00:00Z').getTime()))) {
    throw new HttpError(422, 'due_date geçersiz', 'invalid_due_date')
  }

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const [p] = await tx`select id, member_id from plans where id = ${body.id as string} and group_id = ${m.group_id} for update`
    if (!p) throw new HttpError(404, 'Plan bulunamadı', 'not_found')
    if (p.member_id !== m.member_id) throw new HttpError(403, 'Bu planı sadece sahibi değiştirebilir', 'not_owner')
    if (action === 'postpone') await tx`update plans set due_date = ${due as string}, status = 'open' where id = ${p.id}`
    else await tx`update plans set status = 'dismissed', closed_at = now() where id = ${p.id}`
  })

  return { ok: true }
})
