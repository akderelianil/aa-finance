import * as z from 'zod/mini'
import type { Db, Statement } from '../db.ts'
import { rateOf, toBase } from '../money.ts'
import { uuidv7 } from '../uuid.ts'
import { baseCurrency, date, fail, insert, limits, need, paging, rate, read, text, uid, update, write, type Ctx } from './ctx.ts'
import { rateOn } from './fx.ts'

const amount = z.int().check(z.refine((n) => n !== 0, 'amount is zero'))

/**
 * A line in the account currency. A foreign-currency line gets its base amount from
 * `baseAmount`, else `rate`, else the stored rate on or before the entry date.
 */
const lineInput = z.object({
  account: uid,
  amount,
  baseAmount: z.optional(amount),
  rate: z.optional(rate),
  memo: z.optional(text),
})
export type LineInput = z.output<typeof lineInput>

const entryInput = {
  date,
  reference: z.optional(text),
  description: z.optional(text),
  lines: z.array(lineInput).check(z.minLength(2), z.maxLength(500)),
}
export type EntryInput = z.output<z.ZodMiniObject<typeof entryInput>>

type Resolved = { accountId: number; amount: number; base: number; rate: string | null; memo: string | null }

/**
 * Account currency, base amount and rate per line. A rounding difference up to one minor unit per
 * converted line goes to FX Gains and Losses; anything larger is entry_unbalanced.
 */
async function resolve(db: Db, on: string, lines: LineInput[]): Promise<Resolved[]> {
  const base = await baseCurrency(db)
  const out: Resolved[] = []
  let converted = 0
  for (const [i, l] of lines.entries()) {
    const a = await need(db, 'account_not_found',
      `SELECT a.id, c.code, c.minor_unit FROM accounts a JOIN currencies c ON c.id = a.currency_id
       WHERE a.uid = ? AND a.deleted_at IS NULL`, [l.account])
    const memo = l.memo ?? null
    if (a.code === base.code) {
      if ((l.baseAmount !== undefined && l.baseAmount !== l.amount) || l.rate !== undefined) fail('line_base_mismatch', { line: i })
      out.push({ accountId: a.id as number, amount: l.amount, base: l.amount, rate: null, memo })
      continue
    }
    const minor = a.minor_unit as number
    let r = l.rate
    let b = l.baseAmount
    if (b === undefined) {
      r ??= (await rateOn(db, a.code as string, on))?.rate ?? fail('rate_missing', { line: i, currency: a.code })
      b = toBase(l.amount, r, minor, base.minor)
      converted++
    }
    if (b === 0 || b > 0 !== l.amount > 0) fail('line_base_sign', { line: i })
    out.push({ accountId: a.id as number, amount: l.amount, base: b, rate: r ?? rateOf(l.amount, b, minor, base.minor), memo })
  }
  const diff = out.reduce((s, l) => s + l.base, 0)
  if (diff !== 0) {
    if (Math.abs(diff) > converted) fail('entry_unbalanced', { diff })
    const fx = await need(db, 'not_setup', `SELECT id FROM accounts WHERE system_key = 'fx_gain_loss'`)
    out.push({ accountId: fx.id as number, amount: -diff, base: -diff, rate: null, memo: null })
  }
  return out
}

// entry_id comes from the entry written earlier in the same batch.
const lineSql = `INSERT INTO lines (uid, entry_id, account_id, entry_date, amount, base_amount, rate, memo, position, created_by, updated_by)
  VALUES (?, (SELECT id FROM entries WHERE uid = ?), ?, ?, ?, ?, ?, ?, ?, ?, ?)`

function lineStatements(ctx: Ctx, entryUid: string, on: string, lines: Resolved[]): Statement[] {
  return lines.map((l, i) => ({
    sql: lineSql,
    params: [uuidv7(), entryUid, l.accountId, on, l.amount, l.base, l.rate, l.memo, i, ctx.actor, ctx.actor],
  }))
}

async function numbered(db: Db, entryUid: string) {
  const e = await need(db, 'entry_not_found', 'SELECT year, number FROM entries WHERE uid = ?', [entryUid])
  return { uid: entryUid, year: e.year as number, number: e.number as number }
}

/** Writes and posts a new entry. Returns its uid and number. */
export const post = write(z.object(entryInput), async (ctx, input) => {
  const lines = await resolve(ctx.db, input.date, input.lines)
  const entryUid = uuidv7()
  await ctx.write([
    insert(ctx, 'entries', { uid: entryUid, entry_date: input.date, reference: input.reference ?? null, description: input.description ?? null }),
    ...lineStatements(ctx, entryUid, input.date, lines),
    update(ctx, 'entries', entryUid, { state: 'posted' }),
  ], entryUid)
  return numbered(ctx.db, entryUid)
})

/**
 * Changes an entry. Reference and description change in place. A new date or new lines go through
 * draft: the old lines get deleted_at, the new ones are written, the entry is posted again. The number stays.
 */
export const edit = write(
  z.object({ uid, date: z.optional(date), reference: z.optional(text), description: z.optional(text), lines: z.optional(entryInput.lines) }),
  async (ctx, input) => {
    const e = await need(ctx.db, 'entry_not_found', 'SELECT id, entry_date FROM entries WHERE uid = ? AND deleted_at IS NULL', [input.uid])
    const set: Record<string, string | null> = {}
    if (input.reference !== undefined) set.reference = input.reference
    if (input.description !== undefined) set.description = input.description
    const on = input.date ?? (e.entry_date as string)
    const statements: Statement[] = []
    if (input.lines || on !== e.entry_date) {
      statements.push(update(ctx, 'entries', input.uid, { ...set, state: 'draft', entry_date: on }))
      if (input.lines) {
        const lines = await resolve(ctx.db, on, input.lines)
        const now = Date.now()
        statements.push(
          { sql: 'UPDATE lines SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE entry_id = ? AND deleted_at IS NULL', params: [now, now, ctx.actor, e.id] },
          ...lineStatements(ctx, input.uid, on, lines),
        )
      }
      statements.push(update(ctx, 'entries', input.uid, { state: 'posted' }))
    } else if (Object.keys(set).length) {
      statements.push(update(ctx, 'entries', input.uid, set))
    }
    if (statements.length) await ctx.write(statements, input.uid)
    return numbered(ctx.db, input.uid)
  },
)

/** Soft delete; the lines follow. The number is never reused. */
export const remove = write(z.object({ uid }), async (ctx, input) => {
  await need(ctx.db, 'entry_not_found', 'SELECT 1 FROM entries WHERE uid = ? AND deleted_at IS NULL', [input.uid])
  await ctx.write([update(ctx, 'entries', input.uid, { deleted_at: Date.now() })], input.uid)
  return {}
})

export type Line = { uid: string; account: string; amount: number; baseAmount: number; rate: string | null; memo: string | null }
export type Entry = {
  uid: string
  date: string
  year: number
  number: number
  reference: string | null
  description: string | null
  createdAt: number
  updatedAt: number
  lines: Line[]
}

const entryColumns = 'e.uid, e.entry_date, e.year, e.number, e.reference, e.description, e.created_at, e.updated_at'

/** Entries by uid with their live lines, in the given order. Two queries. */
async function withLines(db: Db, rows: Awaited<ReturnType<Db['query']>>): Promise<Entry[]> {
  const uids = rows.map((r) => r.uid as string)
  const lines = await db.query(
    `SELECT e.uid AS entry, l.uid, a.uid AS account, l.amount, l.base_amount, l.rate, l.memo
     FROM json_each(?) j JOIN entries e ON e.uid = j.value
     JOIN lines l ON l.entry_id = e.id AND l.deleted_at IS NULL
     JOIN accounts a ON a.id = l.account_id
     ORDER BY l.entry_id, l.position, l.id`,
    [JSON.stringify(uids)],
  )
  const by = new Map<string, Line[]>(uids.map((u) => [u, []]))
  for (const l of lines)
    by.get(l.entry as string)!.push({
      uid: l.uid as string, account: l.account as string, amount: l.amount as number,
      baseAmount: l.base_amount as number, rate: l.rate as string | null, memo: l.memo as string | null,
    })
  return rows.map((r) => ({
    uid: r.uid as string,
    date: r.entry_date as string,
    year: r.year as number,
    number: r.number as number,
    reference: r.reference as string | null,
    description: r.description as string | null,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
    lines: by.get(r.uid as string)!,
  }))
}

export const get = read(z.object({ uid }), async (ctx, input) => {
  const r = await need(ctx.db, 'entry_not_found', `SELECT ${entryColumns} FROM entries e WHERE e.uid = ? AND e.deleted_at IS NULL`, [input.uid])
  return (await withLines(ctx.db, [r]))[0]
})

/** General journal: newest first, paged. `search` matches description and reference. */
export const list = read(
  z.object({ from: z.optional(date), to: z.optional(date), search: z.optional(z.string().check(z.trim(), z.maxLength(200))), ...paging }),
  async (ctx, input) => {
    const where = `e.deleted_at IS NULL AND e.entry_date >= ?1 AND e.entry_date <= ?2
      AND (?3 IS NULL OR e.description LIKE ?3 ESCAPE '\\' OR e.reference LIKE ?3 ESCAPE '\\')`
    const like = input.search ? `%${input.search.replace(/[\\%_]/g, '\\$&')}%` : null
    const params = [input.from ?? '0000-01-01', input.to ?? '9999-12-31', like]
    const { limit, offset } = limits(input)
    const [{ total }] = await ctx.db.query(`SELECT count(*) AS total FROM entries e WHERE ${where}`, params)
    const rows = await ctx.db.query(
      `SELECT ${entryColumns} FROM entries e WHERE ${where} ORDER BY e.entry_date DESC, e.id DESC LIMIT ?4 OFFSET ?5`,
      [...params, limit, offset],
    )
    return { total: total as number, rows: await withLines(ctx.db, rows) }
  },
)
