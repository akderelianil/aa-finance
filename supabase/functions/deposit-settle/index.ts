import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import {
  assertNotLocked, entryDate, findOrCreateCategory, loadMember, parseAmount, postRawEntry, resolveAccount, type RawLine,
} from '../_shared/entries.ts'
import { accountNet } from '../_shared/fx.ts'
import { addDays, parseDays, parseRatePercent } from '../_shared/deposit.ts'

// Vade sonu ya da erken bozma: banka ne yaptıysa o kaydedilir (uygulama varsaymaz).
//   outcome 'return': vadesize döndü. received = hedefe yatan gerçek tutar. Fark (received − bakiye) getiri geliri
//                     ya da kesinti gideri olur. Vadeli hesap kapanır.
//   outcome 'renew':  yenilendi. income = gerçekleşen net getiri (vadeliye eklenir), withdrawn = hedefe çekilen
//                     (yalnız anapara yenilendiyse getiri kadar; kısmi çekimde çekilen tutar). Yeni oran ve gün girilir.
serve(async (req, user) => {
  const body = await readBody(req)
  if (typeof body.account_id !== 'string') throw new HttpError(422, 'account geçersiz', 'invalid_account')
  const outcome = body.outcome
  if (outcome !== 'return' && outcome !== 'renew') throw new HttpError(422, 'outcome geçersiz', 'invalid_action')
  const date = entryDate(body.date)
  const targetId = typeof body.target_account_id === 'string' && body.target_account_id ? body.target_account_id : undefined

  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    const [d] = await tx`
      select s.account_id, s.principal::text as principal, s.annual_rate::text as annual_rate, s.days,
             s.start_date::text as start_date, s.maturity_date::text as maturity_date, s.return_account_id,
             s.last_settle_entry_id, s.prev, a.owner_member_id
      from deposit_settings s join accounts a on a.id = s.account_id
      where s.account_id = ${body.account_id as string} and s.group_id = ${m.group_id} and s.closed_at is null
      for update of s, a`
    if (!d) throw new HttpError(404, 'Vadeli hesap bulunamadı', 'not_found')
    if (d.owner_member_id !== m.member_id) throw new HttpError(403, 'Bu hesabı sadece sahibi değiştirebilir', 'not_owner')
    const target = await resolveAccount(tx, m.group_id, m.member_id, m.base_currency, targetId ?? d.return_account_id ?? undefined)
    const { net: balance } = await accountNet(tx, d.account_id)
    const cur = m.base_currency
    const line = (account: string, dir: 'debit' | 'credit', amt: bigint): RawLine => ({ account, dir, amount: amt, currency: cur, base: amt })
    const lines: RawLine[] = []
    const prev = {
      principal: String(d.principal), annual_rate: String(d.annual_rate), days: d.days, start_date: String(d.start_date),
      maturity_date: String(d.maturity_date), last_settle_entry_id: d.last_settle_entry_id, prev: d.prev,
    }
    const income = async () => findOrCreateCategory(tx, m.group_id, 'income', 'Vadeli getiri')

    if (outcome === 'return') {
      const received = parseAmount(body.received, m.exponent)
      lines.push(line(target, 'debit', received))
      if (balance > 0n) lines.push(line(d.account_id, 'credit', balance))
      const diff = received - balance
      if (diff > 0n) lines.push(line(await income(), 'credit', diff))
      if (diff < 0n) lines.push(line(await findOrCreateCategory(tx, m.group_id, 'expense', 'Vadeli bozma kesintisi'), 'debit', -diff))
    } else {
      const gain = body.income === undefined || body.income === '' || body.income === null ? 0n : parseAmount(body.income, m.exponent)
      const withdrawn = body.withdrawn === undefined || body.withdrawn === '' || body.withdrawn === null ? 0n : parseAmount(body.withdrawn, m.exponent)
      if (withdrawn >= balance + gain) throw new HttpError(422, 'Çekilen tutar bakiyeden küçük olmalı', 'invalid_withdrawn')
      if (gain > 0n) lines.push(line(d.account_id, 'debit', gain), line(await income(), 'credit', gain))
      if (withdrawn > 0n) lines.push(line(target, 'debit', withdrawn), line(d.account_id, 'credit', withdrawn))
    }

    const eid = lines.length ? await postRawEntry(tx, m, { date, sourceType: 'deposit', lines }) : null
    if (outcome === 'return') {
      await tx`update deposit_settings set closed_at = now(), last_settle_entry_id = ${eid}, prev = ${tx.json(prev)}
               where account_id = ${d.account_id}`
      await tx`update accounts set archived_at = now() where id = ${d.account_id}`
    } else {
      const { net: principal } = await accountNet(tx, d.account_id)
      const rate = parseRatePercent(body.annual_rate, 'annual_rate')
      const days = body.days === undefined || body.days === '' ? d.days as number : parseDays(body.days)
      // Yeni dönem eski vadeden başlar (geç girilse de); erken yenileme bugünden.
      const start = String(d.maturity_date) <= date ? String(d.maturity_date) : date
      await tx`
        update deposit_settings set principal = ${principal.toString()}, annual_rate = ${rate}, days = ${days},
          start_date = ${start}, maturity_date = ${addDays(start, days)}, last_settle_entry_id = ${eid}, prev = ${tx.json(prev)}
        where account_id = ${d.account_id}`
    }
    return eid
  })

  return { entry_id: entryId }
}, 201)
