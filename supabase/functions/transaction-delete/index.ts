import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { loadMember, loadOwnedEntry } from '../_shared/entries.ts'

// Soft delete: kayıt ve satırları kalır, raporlar deleted_at'a bakar.
serve(async (req, user) => {
  const body = await readBody(req)

  await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    const entry = await loadOwnedEntry(tx, body.entry_id, m)
    // Taksit bağlantıları: alışveriş kaydı silinirse plan kalkar (ödenmiş taksit varsa engel);
    // ödeme kaydı silinirse taksit yeniden açılır.
    const [plan] = await tx`select id from installment_plans where purchase_entry_id = ${entry.id}`
    if (plan) {
      const [paid] = await tx`select 1 from installments where plan_id = ${plan.id} and payment_entry_id is not null limit 1`
      if (paid) throw new HttpError(422, 'Ödenmiş taksitleri olan alışveriş silinemez', 'plan_has_payments')
      await tx`delete from installments where plan_id = ${plan.id}`
      await tx`delete from installment_plans where id = ${plan.id}`
    }
    await tx`update installments set payment_entry_id = null where payment_entry_id = ${entry.id}`
    // Bu kayıtla doğan plan (borç vadesi) da gider.
    await tx`delete from plans where source_entry_id = ${entry.id}`
    // Kredi kaydı silinirse kredi hesabı da gider (başka hareketi varsa silinemez).
    const [loan] = await tx`select account_id from loan_settings where source_entry_id = ${entry.id}`
    if (loan) {
      const [other] = await tx`
        select 1 from journal_lines l join journal_entries e on e.id = l.entry_id
        where l.account_id = ${loan.account_id} and e.deleted_at is null and e.id <> ${entry.id} limit 1`
      if (other) throw new HttpError(422, 'Taksit ödemesi olan kredi silinemez', 'loan_has_payments')
      await tx`delete from loan_settings where account_id = ${loan.account_id}`
      await tx`update accounts set archived_at = now() where id = ${loan.account_id}`
    }
    await tx`update journal_entries set deleted_at = now(), deleted_by = ${m.member_id}, updated_at = now()
             where id = ${entry.id}`
  })

  return { ok: true }
})
