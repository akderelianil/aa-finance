import * as z from 'zod/mini'
import type { Db, Statement } from '../db.ts'
import { rateOf, toBase } from '../money.ts'
import { baseCurrency, date, fail, insert, limits, need, needAdmin, one, owner, ownerSql, paging, rate, read, text, id, update, write, type Ctx } from './ctx.ts'
import { rateOn } from './fx.ts'

const amount = z.int().check(z.refine((n) => n !== 0, 'amount is zero'))

/**
 * A line in the account currency. A foreign-currency line gets its base amount from
 * `baseAmount`, else `rate`, else the stored rate on or before the entry date.
 */
const lineInput = z.object({
  account: id,
  amount,
  baseAmount: z.optional(amount),
  rate: z.optional(rate),
  memo: z.optional(text),
  /** Rehber record this line is with (who owes whom). */
  contact: z.optional(id),
  /** Member this line belongs to (who paid, whose money). Empty: the account's owner. */
  member: z.optional(id),
})
export type LineInput = z.output<typeof lineInput>

const entryInput = {
  date,
  reference: z.optional(text),
  description: z.optional(text),
  lines: z.array(lineInput).check(z.minLength(2), z.maxLength(500)),
}
export type EntryInput = z.output<z.ZodMiniObject<typeof entryInput>>

type Resolved = { accountId: number; amount: number; base: number; rate: string | null; memo: string | null; contact: number | null; member: number | null }

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
       WHERE a.id = ? AND a.deleted_at IS NULL`, [l.account])
    const memo = l.memo ?? null
    const contact = l.contact ?? null
    const member = l.member ?? null
    if (member !== null) await need(db, 'member_not_found', `SELECT 1 FROM actors WHERE id = ? AND kind = 'user' AND deleted_at IS NULL`, [member])
    if (contact !== null) await need(db, 'contact_not_found', 'SELECT 1 FROM contacts WHERE id = ? AND deleted_at IS NULL', [contact])
    if (a.code === base.code) {
      if ((l.baseAmount !== undefined && l.baseAmount !== l.amount) || l.rate !== undefined) fail('line_base_mismatch', { line: i })
      out.push({ accountId: a.id as number, amount: l.amount, base: l.amount, rate: null, memo, contact, member })
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
    out.push({ accountId: a.id as number, amount: l.amount, base: b, rate: r ?? rateOf(l.amount, b, minor, base.minor), memo, contact, member })
  }
  const diff = out.reduce((s, l) => s + l.base, 0)
  if (diff !== 0) {
    if (Math.abs(diff) > converted) fail('entry_unbalanced', { diff })
    const fx = await need(db, 'not_setup', `SELECT id FROM accounts WHERE system_key = 'fx_gain_loss'`)
    out.push({ accountId: fx.id as number, amount: -diff, base: -diff, rate: null, memo: null, contact: null, member: null })
  }
  return out
}

const lineSql = `INSERT INTO lines (entry_id, account_id, entry_date, amount, base_amount, rate, memo, position, contact_id, member_id, created_by, updated_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

function lineStatements(ctx: Ctx, entryId: number, on: string, lines: Resolved[]): Statement[] {
  return lines.map((l, i) => ({
    sql: lineSql,
    params: [entryId, l.accountId, on, l.amount, l.base, l.rate, l.memo, i, l.contact, l.member, ctx.actor, ctx.actor],
  }))
}

async function numbered(db: Db, entryId: number) {
  const e = await need(db, 'entry_not_found', 'SELECT year, number FROM entries WHERE id = ?', [entryId])
  return { id: entryId, year: e.year as number, number: e.number as number }
}

/** Writes and posts a new entry. Returns its id and number. */
export const post = write(z.object(entryInput), async (ctx, input) => {
  const lines = await resolve(ctx.db, input.date, input.lines)
  // Ids only grow (rows are never deleted), so max + 1 is free; the single writer makes it safe.
  const [{ next }] = await ctx.db.query('SELECT coalesce(max(id), 0) + 1 AS next FROM entries')
  const entryId = next as number
  await ctx.write([
    insert(ctx, 'entries', { id: entryId, entry_date: input.date, reference: input.reference ?? null, description: input.description ?? null }),
    ...lineStatements(ctx, entryId, input.date, lines),
    update(ctx, 'entries', entryId, { state: 'posted' }),
  ], String(entryId))
  return numbered(ctx.db, entryId)
})

/**
 * Changes an entry. Reference and description change in place. A new date or new lines go through
 * draft: the old lines get deleted_at, the new ones are written, the entry is posted again. The number stays.
 */
export const edit = write(
  z.object({ id, date: z.optional(date), reference: z.optional(text), description: z.optional(text), lines: z.optional(entryInput.lines) }),
  async (ctx, input) => {
    const e = await need(ctx.db, 'entry_not_found', 'SELECT id, entry_date, created_by FROM entries WHERE id = ? AND deleted_at IS NULL', [input.id])
    await needOwner(ctx, e.created_by as number)
    const set: Record<string, string | null> = {}
    if (input.reference !== undefined) set.reference = input.reference
    if (input.description !== undefined) set.description = input.description
    const on = input.date ?? (e.entry_date as string)
    const statements: Statement[] = []
    if (input.lines || on !== e.entry_date) {
      statements.push(update(ctx, 'entries', input.id, { ...set, state: 'draft', entry_date: on }))
      if (input.lines) {
        const lines = await resolve(ctx.db, on, input.lines)
        const now = ctx.now()
        statements.push(
          { sql: 'UPDATE lines SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE entry_id = ? AND deleted_at IS NULL', params: [now, ctx.actor, now, ctx.actor, e.id] },
          ...lineStatements(ctx, input.id, on, lines),
        )
      }
      statements.push(update(ctx, 'entries', input.id, { state: 'posted' }))
    } else if (Object.keys(set).length) {
      statements.push(update(ctx, 'entries', input.id, set))
    }
    if (statements.length) await ctx.write(statements, String(input.id))
    return numbered(ctx.db, input.id)
  },
)

/** Soft delete; the lines follow. The number is never reused. */
/** A member changes only own entries; an admin all. The entries_owner trigger checks it again. */
async function needOwner(ctx: Ctx, createdBy: number) {
  if (createdBy !== ctx.actor && !(await one(ctx.db, `SELECT 1 FROM actors WHERE id = ? AND role IS NOT 'member'`, [ctx.actor])))
    fail('entry_not_owner')
}

export const remove = write(z.object({ id }), async (ctx, input) => {
  const e = await need(ctx.db, 'entry_not_found', 'SELECT created_by FROM entries WHERE id = ? AND deleted_at IS NULL', [input.id])
  await needOwner(ctx, e.created_by as number)
  await ctx.write([update(ctx, 'entries', input.id, { deleted_at: ctx.now() })], String(input.id))
  return {}
})

/** Admin only. Soft deletes every entry (accounts, members, rates and settings stay). A locked period stops it. */
export const removeAll = write(z.object({}), async (ctx) => {
  await needAdmin(ctx)
  const { n } = await need(ctx.db, 'not_setup', 'SELECT count(*) AS n FROM entries WHERE deleted_at IS NULL')
  const now = ctx.now()
  if (n)
    await ctx.write(
      [{ sql: 'UPDATE entries SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE deleted_at IS NULL', params: [now, ctx.actor, now, ctx.actor] }],
      String(n),
    )
  return { count: n as number }
})

export type Line = { id: number; account: number; amount: number; baseAmount: number; rate: string | null; memo: string | null; contact: number | null; member: number | null }
export type Entry = {
  id: number
  date: string
  year: number
  number: number
  reference: string | null
  description: string | null
  createdAt: number
  updatedAt: number
  /** The member who wrote it. */
  author: { id: number; name: string; color: string | null }
  lines: Line[]
}

const entryColumns = `e.id, e.entry_date, e.year, e.number, e.reference, e.description, e.created_at, e.updated_at,
  u.id AS author_id, u.name AS author_name, u.color AS author_color`
const entryFrom = 'entries e JOIN actors u ON u.id = e.created_by'

/** Entries with their live lines, in the given order. Two queries. */
async function withLines(db: Db, rows: Awaited<ReturnType<Db['query']>>): Promise<Entry[]> {
  const ids = rows.map((r) => r.id as number)
  const lines = await db.query(
    `SELECT l.entry_id AS entry, l.id, l.account_id AS account, l.amount, l.base_amount, l.rate, l.memo, l.contact_id AS contact, l.member_id AS member
     FROM json_each(?) j JOIN lines l ON l.entry_id = j.value AND l.deleted_at IS NULL
     ORDER BY l.entry_id, l.position, l.id`,
    [JSON.stringify(ids)],
  )
  const by = new Map<number, Line[]>(ids.map((i) => [i, []]))
  for (const l of lines)
    by.get(l.entry as number)!.push({
      id: l.id as number, account: l.account as number, amount: l.amount as number,
      baseAmount: l.base_amount as number, rate: l.rate as string | null, memo: l.memo as string | null, contact: l.contact as number | null, member: l.member as number | null,
    })
  return rows.map((r) => ({
    id: r.id as number,
    date: r.entry_date as string,
    year: r.year as number,
    number: r.number as number,
    reference: r.reference as string | null,
    description: r.description as string | null,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
    author: { id: r.author_id as number, name: r.author_name as string, color: r.author_color as string | null },
    lines: by.get(r.id as number)!,
  }))
}

export const get = read(z.object({ id }), async (ctx, input) => {
  const r = await need(ctx.db, 'entry_not_found', `SELECT ${entryColumns} FROM ${entryFrom} WHERE e.id = ? AND e.deleted_at IS NULL`, [input.id])
  return (await withLines(ctx.db, [r]))[0]
})

/** General journal: newest first, paged. `search` matches description and reference. */
export const list = read(
  z.object({ from: z.optional(date), to: z.optional(date), search: z.optional(z.string().check(z.trim(), z.maxLength(200))), owner, ...paging }),
  async (ctx, input) => {
    // With an owner, only entries that touch one of that owner's accounts.
    const o = ownerSql(input.owner, 'coalesce(l.member_id, a.owner_id)')
    const byOwner = o.sql
      ? ` AND EXISTS (SELECT 1 FROM lines l JOIN accounts a ON a.id = l.account_id
                      WHERE l.entry_id = e.id AND l.deleted_at IS NULL${o.sql.replace('= ?', '= ?4')})`
      : ''
    const where = `e.deleted_at IS NULL AND e.entry_date >= ?1 AND e.entry_date <= ?2
      AND (?3 IS NULL OR e.description LIKE ?3 ESCAPE '\\' OR e.reference LIKE ?3 ESCAPE '\\')${byOwner}`
    const like = input.search ? `%${input.search.replace(/[\\%_]/g, '\\$&')}%` : null
    const params = [input.from ?? '0000-01-01', input.to ?? '9999-12-31', like, ...o.params]
    const { limit, offset } = limits(input)
    const [{ total }] = await ctx.db.query(`SELECT count(*) AS total FROM ${entryFrom} WHERE ${where}`, params)
    const n = params.length
    const rows = await ctx.db.query(
      `SELECT ${entryColumns} FROM ${entryFrom} WHERE ${where} ORDER BY e.entry_date DESC, e.id DESC LIMIT ?${n + 1} OFFSET ?${n + 2}`,
      [...params, limit, offset],
    )
    return { total: total as number, rows: await withLines(ctx.db, rows) }
  },
)
