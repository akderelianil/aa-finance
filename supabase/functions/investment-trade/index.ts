import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql, type Tx } from '../_shared/db.ts'
import { uuidv7 } from '../_shared/uuid.ts'
import {
  assertNotLocked, entryDate, loadMember, lockOwnAccount, parseAmount, postRawEntry, resolveAccount, type RawLine,
} from '../_shared/entries.ts'
import {
  accountNet, averageCost, exponentOf, minorOf, parsePositiveDecimal, parseRate, resolveRate, saveRate, toBase,
} from '../_shared/fx.ts'

// Yatırım alım/satımı. Yatırım hesabı üye+enstrüman başına ilk alımda otomatik açılır.
//  Alım : Borç yatırım hesabı (adet×fiyat + komisyon) / Alacak ödeme hesabı.
//  Satım: Borç ödeme hesabı (adet×fiyat − komisyon) / Alacak yatırım hesabı (defter değeri, adetle orantılı);
//         fark investment_gain_loss'a yazılır.
// Ödeme hesabı enstrümanla aynı para biriminde ya da ana para biriminde olmalı (TRY ile USD hisse: kur/base_amount).
const KINDS = ['crypto', 'commodity', 'stock', 'fund', 'bond']

async function resolveInstrument(tx: Tx, groupId: string, body: Record<string, unknown>) {
  if (typeof body.instrument_id === 'string') {
    const [i] = await tx`select id, symbol, currency from instruments where id = ${body.instrument_id} and group_id = ${groupId}`
    if (!i) throw new HttpError(422, 'instrument geçersiz', 'invalid_instrument')
    return i as { id: string; symbol: string; currency: string }
  }
  const nw = body.instrument as Record<string, unknown> | undefined
  if (!nw) throw new HttpError(422, 'instrument geçersiz', 'invalid_instrument')
  const kind = typeof nw.kind === 'string' && KINDS.includes(nw.kind) ? nw.kind : null
  if (!kind) throw new HttpError(422, 'instrument geçersiz', 'invalid_instrument')
  const symbol = requireString(nw.symbol, 'symbol', 30).toUpperCase()
  const name = nw.name ? requireString(nw.name, 'name', 100) : symbol
  const currency = requireString(nw.currency, 'currency', 3).toUpperCase()
  await exponentOf(tx, currency)
  const [found] = await tx`
    select id, symbol, currency from instruments where group_id = ${groupId} and kind = ${kind} and upper(symbol) = ${symbol}`
  if (found) return found as { id: string; symbol: string; currency: string }
  const id = uuidv7()
  await tx`insert into instruments (id, group_id, kind, symbol, name, currency) values (${id}, ${groupId}, ${kind}, ${symbol}, ${name}, ${currency})`
  return { id, symbol, currency }
}

serve(async (req, user) => {
  const body = await readBody(req)
  const side = body.side
  if (side !== 'buy' && side !== 'sell') throw new HttpError(422, 'side geçersiz', 'invalid_side')
  const qty = parsePositiveDecimal(body.quantity, 'quantity')
  const price = parsePositiveDecimal(body.price, 'price')
  const date = entryDate(body.date)
  const givenRate = parseRate(body.rate)

  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    const inst = await resolveInstrument(tx, m.group_id, body)
    const iExp = await exponentOf(tx, inst.currency)
    const feeRaw = body.fee
    const noFee = feeRaw === undefined || feeRaw === null || feeRaw === '' || Number(feeRaw) === 0
    const fee = noFee ? 0n : parseAmount(feeRaw, iExp)
    const gross = await minorOf(tx, qty, price, iExp)
    if (gross <= 0n) throw new HttpError(422, 'Tutar çok küçük', 'invalid_amount')
    // Yatırım/ödeme tarafının enstrüman para birimi tutarı.
    const value = side === 'buy' ? gross + fee : gross - fee
    if (value <= 0n) throw new HttpError(422, 'Komisyon tutardan büyük', 'invalid_amount')

    // Yatırım hesabı (kilitle / aç).
    let [inv] = await tx`
      select id from accounts where owner_member_id = ${m.member_id} and instrument_id = ${inst.id} for update`
    if (!inv) {
      if (side === 'sell') throw new HttpError(422, 'Bu yatırımdan elinde yok', 'insufficient_quantity')
      const id = uuidv7()
      await tx`
        insert into accounts (id, group_id, owner_member_id, type, subtype, name, currency, instrument_id)
        values (${id}, ${m.group_id}, ${m.member_id}, 'asset', 'investment', ${inst.symbol}, ${inst.currency}, ${inst.id})`
      inv = { id }
    }
    const pay = typeof body.account_id === 'string'
      ? await lockOwnAccount(tx, m.group_id, m.member_id, body.account_id)
      : { id: await resolveAccount(tx, m.group_id, m.member_id, m.base_currency), currency: m.base_currency }

    let estimated = false

    // Enstrüman para birimi tutarının ana para birimi karşılığı (kur: verilen / son kayıtlı).
    const baseFor = async (amount: bigint) => {
      if (inst.currency === m.base_currency) return amount
      const rate = await resolveRate(tx, m.group_id, inst.currency, m.base_currency, givenRate)
      return toBase(tx, amount, iExp, m.exponent, rate)
    }
    if (givenRate && inst.currency !== m.base_currency) {
      await saveRate(tx, m.group_id, inst.currency, m.base_currency, date, givenRate)
    }

    // Ödeme hesabı tarafı: tutar (hesap para biriminde) ve ana para birimi karşılığı.
    let payAmount: bigint
    let payBase: bigint
    if (pay.currency === inst.currency) {
      payAmount = value
      if (side === 'buy') payBase = pay.currency === m.base_currency ? value : await averageCost(tx, pay.id, value)
      else payBase = await baseFor(value)
    } else if (pay.currency === m.base_currency) {
      if (body.base_amount !== undefined && body.base_amount !== null && body.base_amount !== '') {
        payBase = parseAmount(body.base_amount, m.exponent)
      } else {
        payBase = await baseFor(value)
        estimated = true
      }
      payAmount = payBase
    } else {
      throw new HttpError(422, 'Ödeme hesabının para birimi uyumsuz', 'currency_mismatch')
    }

    const [hold] = await tx`
      select coalesce(sum(case when t.side = 'buy' then t.quantity else -t.quantity end), 0)::text as q
      from investment_trades t join journal_entries e on e.id = t.entry_id
      where t.account_id = ${inv.id} and e.deleted_at is null`

    const lines: RawLine[] = []
    if (side === 'buy') {
      lines.push(
        { account: inv.id, dir: 'debit', amount: value, currency: inst.currency, base: payBase },
        { account: pay.id, dir: 'credit', amount: payAmount, currency: pay.currency, base: payBase },
      )
    } else {
      const [cmp] = await tx`select (${qty}::numeric <= ${hold.q as string}::numeric) as ok, (${qty}::numeric = ${hold.q as string}::numeric) as full`
      if (!cmp.ok) throw new HttpError(422, 'Elindeki adetten fazlasını satamazsın', 'insufficient_quantity')
      const { net, netBase } = await accountNet(tx, inv.id)
      let bookA = net
      let bookB = netBase
      if (!cmp.full) {
        const [frac] = await tx`
          select round(${net.toString()}::numeric * ${qty}::numeric / ${hold.q as string}::numeric)::text as a,
                 round(${netBase.toString()}::numeric * ${qty}::numeric / ${hold.q as string}::numeric)::text as b`
        bookA = BigInt(frac.a as string)
        bookB = BigInt(frac.b as string)
      }
      if (bookA <= 0n || bookB <= 0n) throw new HttpError(422, 'Defter değeri hesaplanamadı', 'invalid_amount')
      lines.push(
        { account: pay.id, dir: 'debit', amount: payAmount, currency: pay.currency, base: payBase },
        { account: inv.id, dir: 'credit', amount: bookA, currency: inst.currency, base: bookB },
      )
      if (payBase !== bookB) {
        const [g] = await tx`select id from accounts where group_id = ${m.group_id} and system_key = 'investment_gain_loss'`
        const gain = payBase > bookB
        lines.push({
          account: g.id, dir: gain ? 'credit' : 'debit', amount: gain ? payBase - bookB : bookB - payBase,
          currency: m.base_currency, base: gain ? payBase - bookB : bookB - payBase,
        })
      }
    }

    const eid = await postRawEntry(tx, m, { date, sourceType: 'investment', isEstimated: estimated, lines })
    await tx`
      insert into investment_trades (id, entry_id, account_id, instrument_id, side, quantity, price, fee)
      values (${uuidv7()}, ${eid}, ${inv.id}, ${inst.id}, ${side}, ${qty}, ${price}, ${fee.toString()})`
    return eid
  })

  return { entry_id: entryId }
}, 201)
