import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { assertNotLocked, entryDate, loadMember, lockOwnAccount, parseAmount, postRawEntry, type RawLine } from '../_shared/entries.ts'
import { averageCost, exponentOf, fxGainLossAccount, saveRate } from '../_shared/fx.ts'

// Döviz alım/satımı: iki hesap, biri ana para biriminde (TRY), diğeri döviz hesabı.
//  Alım : Borç döviz hesabı (base = ödenen TRY) / Alacak TRY hesabı. Kur = TRY / döviz (otomatik).
//  Satım: Borç TRY hesabı (gelen TRY) / Alacak döviz hesabı (ortalama maliyetle);
//         gelen TRY ile maliyet farkı fx_gain_loss'a yazılır.
// İstek: from_account_id, to_account_id, from_amount, to_amount (kendi para birimlerinde), date?
serve(async (req, user) => {
  const body = await readBody(req)
  const date = entryDate(body.date)

  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    if (body.from_account_id === body.to_account_id) throw new HttpError(422, 'Aynı hesap', 'same_account')

    const ids = [body.from_account_id, body.to_account_id].map(String).sort()
    const locked = new Map<string, Awaited<ReturnType<typeof lockOwnAccount>>>()
    for (const id of ids) locked.set(id, await lockOwnAccount(tx, m.group_id, m.member_id, id))
    const from = locked.get(String(body.from_account_id))!
    const to = locked.get(String(body.to_account_id))!

    if (from.currency === to.currency || (from.currency !== m.base_currency && to.currency !== m.base_currency)) {
      throw new HttpError(422, 'Biri ana para biriminde, diğeri döviz hesabı olmalı', 'currency_mismatch')
    }
    const fromAmount = parseAmount(body.from_amount, await exponentOf(tx, from.currency))
    const toAmount = parseAmount(body.to_amount, await exponentOf(tx, to.currency))

    const buying = from.currency === m.base_currency // TRY → döviz
    const fx = buying ? to : from
    const fxAmount = buying ? toAmount : fromAmount
    const baseAmount = buying ? fromAmount : toAmount // TRY tarafı

    // Kur = TRY / döviz birimi (kayıt için; hesap kuruşla yapılır).
    const [rate] = await tx`
      select round(${baseAmount.toString()}::numeric / power(10::numeric, ${await exponentOf(tx, m.base_currency)})
                   / (${fxAmount.toString()}::numeric / power(10::numeric, ${await exponentOf(tx, fx.currency)})), 10)::text as r`
    await saveRate(tx, m.group_id, fx.currency, m.base_currency, date, rate.r as string)

    const lines: RawLine[] = []
    if (buying) {
      lines.push(
        { account: to.id, dir: 'debit', amount: toAmount, currency: to.currency, base: fromAmount, rate: rate.r },
        { account: from.id, dir: 'credit', amount: fromAmount, currency: from.currency, base: fromAmount },
      )
    } else {
      const cost = await averageCost(tx, from.id, fromAmount)
      lines.push(
        { account: to.id, dir: 'debit', amount: toAmount, currency: to.currency, base: toAmount },
        { account: from.id, dir: 'credit', amount: fromAmount, currency: from.currency, base: cost, rate: rate.r },
      )
      if (toAmount !== cost) {
        // Gelen TRY > maliyet: kâr (alacak); aksi halde zarar (borç).
        const gain = toAmount > cost
        lines.push({
          account: await fxGainLossAccount(tx, m.group_id), dir: gain ? 'credit' : 'debit',
          amount: gain ? toAmount - cost : cost - toAmount, currency: m.base_currency,
          base: gain ? toAmount - cost : cost - toAmount,
        })
      }
    }
    return postRawEntry(tx, m, { date, sourceType: 'fx_exchange', lines })
  })

  return { entry_id: entryId }
}, 201)
