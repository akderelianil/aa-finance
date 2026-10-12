import * as z from 'zod/mini'
import type { Db } from '../db.ts'
import { uuidv7 } from '../uuid.ts'
import { currency, date, fail, insert, need, one, rate, read, uid, update, write } from './ctx.ts'

export type FxRate = { uid: string; currency: string; date: string; rate: string }

export const list = read(z.object({ currency: z.optional(currency) }), async (ctx, input): Promise<FxRate[]> => {
  const rows = await ctx.db.query(
    `SELECT f.uid, c.code, f.date, f.rate FROM fx_rates f JOIN currencies c ON c.id = f.currency_id
     WHERE f.deleted_at IS NULL AND (?1 IS NULL OR c.code = ?1) ORDER BY c.code, f.date DESC`,
    [input.currency ?? null],
  )
  return rows.map((r) => ({ uid: r.uid as string, currency: r.code as string, date: r.date as string, rate: r.rate as string }))
})

/** The latest rate on or before the date, or null. For the entry forms. */
export const get = read(z.object({ currency, date }), (ctx, input) => rateOn(ctx.db, input.currency, input.date))

export async function rateOn(db: Db, code: string, on: string): Promise<{ date: string; rate: string } | null> {
  const r = await one(db,
    `SELECT f.date, f.rate FROM fx_rates f WHERE f.currency_id = (SELECT id FROM currencies WHERE code = ?)
     AND f.date <= ? AND f.deleted_at IS NULL ORDER BY f.date DESC LIMIT 1`,
    [code, on])
  return r && { date: r.date as string, rate: r.rate as string }
}

/** Sets the rate of one currency on one date: updates the live row or adds one. */
export const set = write(z.object({ currency, date, rate }), async (ctx, input) => {
  const base = await need(ctx.db, 'not_setup', `SELECT value FROM settings WHERE key = 'base_currency'`)
  if (base.value === input.currency) fail('fx_base_currency')
  const cur = await need(ctx.db, 'currency_unknown', 'SELECT id FROM currencies WHERE code = ?', [input.currency])
  const old = await one(ctx.db, 'SELECT uid FROM fx_rates WHERE currency_id = ? AND date = ? AND deleted_at IS NULL', [cur.id, input.date])
  const rowUid = (old?.uid as string | undefined) ?? uuidv7()
  await ctx.write(
    [old ? update(ctx, 'fx_rates', rowUid, { rate: input.rate })
      : insert(ctx, 'fx_rates', { uid: rowUid, currency_id: cur.id, date: input.date, rate: input.rate })],
    `${input.currency} ${input.date} ${input.rate}`,
  )
  return { uid: rowUid }
})

export const remove = write(z.object({ uid }), async (ctx, input) => {
  await need(ctx.db, 'fx_rate_not_found', 'SELECT 1 FROM fx_rates WHERE uid = ? AND deleted_at IS NULL', [input.uid])
  await ctx.write([update(ctx, 'fx_rates', input.uid, { deleted_at: Date.now() })], input.uid)
  return {}
})
