import { HttpError, readBody, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import { assertNotLocked, entryDate, loadMember, postRawEntry } from '../_shared/entries.ts'
import { accountNet, exponentOf, minorOf, parsePositiveDecimal, ratio } from '../_shared/fx.ts'

// Değerleme: elle girilen son fiyatla yatırımın defter değeri piyasa değerine çekilir.
// Fark (fiyat etkisi, kayıtlı kurla) investment_gain_loss'a yazılır; kur etkisi ayrıca işlenmez.
//  Artış: Borç yatırım / Alacak kâr-zarar.  Düşüş: Borç kâr-zarar / Alacak yatırım.
serve(async (req, user) => {
  const body = await readBody(req)
  if (typeof body.instrument_id !== 'string') throw new HttpError(422, 'instrument geçersiz', 'invalid_instrument')
  const price = parsePositiveDecimal(body.price, 'price')
  const date = entryDate(body.date)

  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)
    const [inst] = await tx`select id, currency from instruments where id = ${body.instrument_id as string} and group_id = ${m.group_id}`
    if (!inst) throw new HttpError(422, 'instrument geçersiz', 'invalid_instrument')
    const [inv] = await tx`
      select id from accounts where owner_member_id = ${m.member_id} and instrument_id = ${inst.id} for update`
    if (!inv) throw new HttpError(422, 'Bu yatırımdan elinde yok', 'insufficient_quantity')

    await tx`
      insert into instrument_prices (instrument_id, price_date, price) values (${inst.id}, ${date}, ${price})
      on conflict (instrument_id, price_date) do update set price = excluded.price`

    const [hold] = await tx`
      select coalesce(sum(case when t.side = 'buy' then t.quantity else -t.quantity end), 0)::text as q
      from investment_trades t join journal_entries e on e.id = t.entry_id
      where t.account_id = ${inv.id} and e.deleted_at is null`
    const [pos] = await tx`select (${hold.q as string}::numeric > 0) as ok`
    if (!pos.ok) throw new HttpError(422, 'Bu yatırımdan elinde yok', 'insufficient_quantity')

    const exp = await exponentOf(tx, inst.currency)
    const target = await minorOf(tx, hold.q as string, price, exp)
    const { net, netBase } = await accountNet(tx, inv.id)
    if (net <= 0n) throw new HttpError(422, 'Defter değeri hesaplanamadı', 'invalid_amount')
    const delta = target - net
    if (delta === 0n) return null
    const absDelta = delta > 0n ? delta : -delta
    let deltaBase = absDelta
    if (inst.currency !== m.base_currency) {
      deltaBase = await ratio(tx, netBase, absDelta, net)
      if (deltaBase <= 0n) deltaBase = 1n
    }
    const [g] = await tx`select id from accounts where group_id = ${m.group_id} and system_key = 'investment_gain_loss'`
    const up = delta > 0n
    return postRawEntry(tx, m, {
      date, sourceType: 'valuation',
      lines: [
        { account: inv.id, dir: up ? 'debit' : 'credit', amount: absDelta, currency: inst.currency, base: deltaBase },
        { account: g.id, dir: up ? 'credit' : 'debit', amount: deltaBase, currency: m.base_currency, base: deltaBase },
      ],
    })
  })

  return { entry_id: entryId }
}, 201)
