import { HttpError, readBody, requireString, serve } from '../_shared/http.ts'
import { setActor, sql } from '../_shared/db.ts'
import {
  assertNotLocked, entryDate, findOrCreateCategory, findOrCreateContact, learnBrandCategory, loadMember, lockOwnAccount,
  parseAmount, postRawEntry, resolveAccount, type RawLine,
} from '../_shared/entries.ts'
import {
  averageCost, exponentOf, fxGainLossAccount, parseRate, resolveRate, saveRate, toBase,
} from '../_shared/fx.ts'
import { parseSplit, splitDebitLines } from '../_shared/split.ts'

// Hızlı gider/gelir kaydı (ana para biriminde). Tek transaction, çift taraflı:
//   gider: Borç kategori / Alacak hesap     gelir: Borç hesap / Alacak kategori
// Opsiyonel/otomatik: tarih (bugün), hesap (üyenin nakit hesabı, yoksa açılır),
// kategori ve kişi (isimle bulunur, yoksa açılır).
// Döviz: (A) döviz hesabından/hesabına: tutar hesabın para biriminde; harcamada ortalama maliyetle düşülür,
// piyasa farkı fx_gain_loss'a yazılır. (B) `currency` farklı + TRY hesap (yurt dışı kart): TRY karşılığı
// kurdan tahmin edilir (is_estimated), `base_amount` verilirse kesin tutar olur.
// Paylaştır (`split`, yalnız ana para biriminde gider): benim payım gider, diğerleri bana borçlu.

serve(async (req, user) => {
  const body = await readBody(req)
  const kind = body.kind
  if (kind !== 'expense' && kind !== 'income') throw new HttpError(422, 'kind geçersiz', 'invalid_kind')
  const categoryName = requireString(body.category_name, 'category_name', 60)
  const contactName = body.contact_name ? requireString(body.contact_name, 'contact_name', 100) : null
  const description = body.description ? requireString(body.description, 'description', 200) : ''
  const date = entryDate(body.date)
  const givenRate = parseRate(body.rate)
  const reqCurrency = body.currency ? requireString(body.currency, 'currency', 3).toUpperCase() : null
  const split = parseSplit(body.split)
  if (split && kind !== 'expense') throw new HttpError(422, 'split geçersiz', 'invalid_split')

  const entryId = await sql.begin(async (tx) => {
    const m = await loadMember(tx, user.id)
    await setActor(tx, m.member_id)
    assertNotLocked(m.lock_date, date)

    const acct = typeof body.account_id === 'string'
      ? await lockOwnAccount(tx, m.group_id, m.member_id, body.account_id)
      : { id: await resolveAccount(tx, m.group_id, m.member_id, m.base_currency),
          currency: m.base_currency, type: 'asset' as const }
    const currency = reqCurrency ?? acct.currency
    if (acct.currency !== m.base_currency && currency !== acct.currency) {
      throw new HttpError(422, 'Hesap para birimi uyumsuz', 'currency_mismatch')
    }
    const exp = await exponentOf(tx, currency)
    const amount = parseAmount(body.amount, exp)
    const baseExp = m.exponent

    const catId = await findOrCreateCategory(tx, m.group_id, kind, categoryName)
    const contactId = contactName ? await findOrCreateContact(tx, m.group_id, contactName, 'brand') : null
    await learnBrandCategory(tx, contactId, catId)
    const lines: RawLine[] = []
    let estimated = false

    const push = (account: string, dir: 'debit' | 'credit', amt: bigint, cur: string, base: bigint, rate?: string) =>
      lines.push({ account, dir, amount: amt, currency: cur, base, rate, contactId })

    if (split && currency !== m.base_currency) throw new HttpError(422, 'split geçersiz', 'invalid_split')
    if (split) {
      lines.push(...await splitDebitLines(tx, m, catId, amount, split, contactId))
      push(acct.id, 'credit', amount, currency, amount)
    } else if (currency === m.base_currency) {
      push(catId, kind === 'expense' ? 'debit' : 'credit', amount, currency, amount)
      push(acct.id, kind === 'expense' ? 'credit' : 'debit', amount, currency, amount)
    } else if (acct.currency !== m.base_currency) {
      // (A) Döviz hesabı.
      const rate = await resolveRate(tx, m.group_id, currency, m.base_currency, givenRate)
      if (givenRate) await saveRate(tx, m.group_id, currency, m.base_currency, date, givenRate)
      const market = await toBase(tx, amount, exp, baseExp, rate)
      if (kind === 'income') {
        push(catId, 'credit', amount, currency, market, rate)
        push(acct.id, 'debit', amount, currency, market, rate)
      } else {
        const cost = await averageCost(tx, acct.id, amount)
        push(catId, 'debit', amount, currency, market, rate)
        push(acct.id, 'credit', amount, currency, cost, rate)
        if (market !== cost) {
          // Harcanan dövizin piyasa değeri maliyetten fazlaysa kâr (alacak), azsa zarar (borç).
          const gain = market > cost
          lines.push({
            account: await fxGainLossAccount(tx, m.group_id), dir: gain ? 'credit' : 'debit',
            amount: gain ? market - cost : cost - market, currency: m.base_currency,
            base: gain ? market - cost : cost - market,
          })
        }
      }
    } else {
      // (B) TRY hesap, yabancı para tutarı (yurt dışı kart harcaması vb.).
      let base: bigint
      let rate: string
      if (body.base_amount !== undefined && body.base_amount !== null && body.base_amount !== '') {
        base = parseAmount(body.base_amount, baseExp)
        const [r] = await tx`
          select round((${base.toString()}::numeric / power(10::numeric, ${baseExp}))
                       / (${amount.toString()}::numeric / power(10::numeric, ${exp})), 10)::text as r`
        rate = r.r as string
      } else {
        rate = await resolveRate(tx, m.group_id, currency, m.base_currency, givenRate)
        base = await toBase(tx, amount, exp, baseExp, rate)
        estimated = true
      }
      if (givenRate) await saveRate(tx, m.group_id, currency, m.base_currency, date, givenRate)
      push(catId, kind === 'expense' ? 'debit' : 'credit', amount, currency, base, rate)
      push(acct.id, kind === 'expense' ? 'credit' : 'debit', base, m.base_currency, base)
    }

    return postRawEntry(tx, m, { date, description, isEstimated: estimated, lines })
  })

  return { entry_id: entryId }
}, 201)
