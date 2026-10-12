import * as z from 'zod/mini'
import type { AccountType } from '../chart.ts'
import { currency, date, insert, limits, name, need, one, paging, read, id, update, write } from './ctx.ts'

export type Account = {
  id: number
  parent: number | null
  name: string
  type: AccountType
  currency: string
  placeholder: boolean
  locked: boolean
  systemKey: string | null
  archived: boolean
  /** Own lines only, signed (+debit). The UI rolls children up in base. */
  balance: number
  baseBalance: number
}

/** All live accounts with own balances up to `asOf` (default: all dates). */
export const list = read(z.object({ asOf: z.optional(date) }), async (ctx, input): Promise<Account[]> => {
  const rows = await ctx.db.query(
    `SELECT a.id, a.parent_id AS parent, a.name, a.type, c.code AS currency, a.is_placeholder, a.locked, a.system_key,
            a.archived_at, coalesce(b.amount, 0) AS balance, coalesce(b.base, 0) AS base
     FROM accounts a
     JOIN currencies c ON c.id = a.currency_id
     LEFT JOIN (
       SELECT account_id, sum(amount) AS amount, sum(base_amount) AS base FROM lines
       WHERE deleted_at IS NULL AND entry_date <= ? GROUP BY account_id
     ) b ON b.account_id = a.id
     WHERE a.deleted_at IS NULL
     ORDER BY a.id`,
    [input.asOf ?? '9999-12-31'],
  )
  return rows.map((r) => ({
    id: r.id as number,
    parent: r.parent as number | null,
    name: r.name as string,
    type: r.type as AccountType,
    currency: r.currency as string,
    placeholder: r.is_placeholder === 1,
    locked: r.locked === 1,
    systemKey: r.system_key as string | null,
    archived: r.archived_at !== null,
    balance: r.balance as number,
    baseBalance: r.base as number,
  }))
})

/** Account ids by use in the last 180 days, most used first (Hızlı Kayıt shortcuts). */
export const usage = read(z.object({}), async (ctx): Promise<number[]> => {
  const rows = await ctx.db.query(
    `SELECT account_id FROM lines
     WHERE deleted_at IS NULL AND entry_date >= date('now', '-180 days')
     GROUP BY account_id ORDER BY count(*) DESC, max(entry_date) DESC LIMIT 40`)
  return rows.map((r) => r.account_id as number)
})

/** Type comes from the parent. Currency defaults to the base currency. */
export const create = write(
  z.object({ parent: id, name, currency: z.optional(currency), placeholder: z.optional(z.boolean()) }),
  async (ctx, input) => {
    const parent = await need(ctx.db, 'account_not_found', 'SELECT id, type FROM accounts WHERE id = ? AND deleted_at IS NULL', [input.parent])
    const cur = input.currency
      ? await need(ctx.db, 'currency_unknown', 'SELECT id FROM currencies WHERE code = ?', [input.currency])
      : await need(ctx.db, 'not_setup', `SELECT c.id FROM currencies c JOIN settings s ON s.value = c.code WHERE s.key = 'base_currency'`)
    await ctx.write(
      [insert(ctx, 'accounts', {
        parent_id: parent.id, name: input.name, type: parent.type, currency_id: cur.id, is_placeholder: input.placeholder ? 1 : 0,
      })],
      input.name,
    )
    return { id: Number((await ctx.db.query('SELECT max(id) AS id FROM accounts'))[0].id) }
  },
)

export const edit = write(
  z.object({ id, name: z.optional(name), parent: z.optional(id), currency: z.optional(currency), placeholder: z.optional(z.boolean()) }),
  async (ctx, input) => {
    await live(ctx.db, input.id)
    const set: Record<string, string | number | null> = {}
    if (input.name !== undefined) set.name = input.name
    if (input.placeholder !== undefined) set.is_placeholder = input.placeholder ? 1 : 0
    if (input.parent !== undefined) set.parent_id = (await live(ctx.db, input.parent)).id
    if (input.currency !== undefined)
      set.currency_id = (await need(ctx.db, 'currency_unknown', 'SELECT id FROM currencies WHERE code = ?', [input.currency])).id
    if (Object.keys(set).length) await ctx.write([update(ctx, 'accounts', input.id, set)], String(input.id))
    return {}
  },
)

export const archive = write(z.object({ id, archived: z.boolean() }), async (ctx, input) => {
  await live(ctx.db, input.id)
  await ctx.write([update(ctx, 'accounts', input.id, { archived_at: input.archived ? Date.now() : null })], String(input.id))
  return {}
})

/** Soft delete. Only an account without live lines and children (the database checks). */
export const remove = write(z.object({ id }), async (ctx, input) => {
  await live(ctx.db, input.id)
  await ctx.write([update(ctx, 'accounts', input.id, { deleted_at: Date.now() })], String(input.id))
  return {}
})

async function live(db: Parameters<typeof need>[0], accountId: number) {
  return need(db, 'account_not_found', 'SELECT id FROM accounts WHERE id = ? AND deleted_at IS NULL', [accountId])
}

export type RegisterRow = {
  line: number
  entry: number
  date: string
  year: number
  number: number
  reference: string | null
  description: string | null
  memo: string | null
  amount: number
  baseAmount: number
  rate: string | null
  /** Running balance in the account currency. */
  balance: number
  /** The other account when the entry has exactly one other line, else null. */
  other: number | null
  otherCount: number
}

/** Account register: lines oldest first, paged, with a running balance from `opening`. */
export const register = read(
  z.object({ id, from: z.optional(date), to: z.optional(date), ...paging }),
  async (ctx, input) => {
    const acc = await live(ctx.db, input.id)
    const from = input.from ?? '0000-01-01'
    const to = input.to ?? '9999-12-31'
    const { limit, offset } = limits(input)
    const head = await one(ctx.db,
      `SELECT coalesce(sum(CASE WHEN entry_date < ?2 THEN amount END), 0) AS opening,
              count(CASE WHEN entry_date >= ?2 AND entry_date <= ?3 THEN 1 END) AS total
       FROM lines WHERE account_id = ?1 AND deleted_at IS NULL AND entry_date <= ?3`,
      [acc.id, from, to])
    const opening = head!.opening as number
    const rows = await ctx.db.query(
      `WITH r AS (
         SELECT l.id, l.entry_id, l.position, l.entry_date, l.memo, l.amount, l.base_amount, l.rate,
                sum(l.amount) OVER (ORDER BY l.entry_date, l.entry_id, l.position, l.id) AS run
         FROM lines l
         WHERE l.account_id = ?1 AND l.deleted_at IS NULL AND l.entry_date >= ?2 AND l.entry_date <= ?3
         -- Page here, so the joins and subqueries below run for one page only.
         ORDER BY l.entry_date, l.entry_id, l.position, l.id
         LIMIT ?5 OFFSET ?6
       )
       SELECT r.id, r.entry_id AS entry, r.entry_date, e.year, e.number, e.reference, e.description, r.memo,
              r.amount, r.base_amount, r.rate, r.run + ?4 AS balance,
              (SELECT count(*) FROM lines o WHERE o.entry_id = r.entry_id AND o.id <> r.id AND o.deleted_at IS NULL) AS other_count,
              (SELECT o.account_id FROM lines o
               WHERE o.entry_id = r.entry_id AND o.id <> r.id AND o.deleted_at IS NULL LIMIT 1) AS other
       FROM r
       JOIN entries e ON e.id = r.entry_id
       ORDER BY r.entry_date, r.entry_id, r.position, r.id`,
      [acc.id, from, to, opening, limit, offset],
    )
    return {
      opening,
      total: head!.total as number,
      rows: rows.map((r): RegisterRow => ({
        line: r.id as number,
        entry: r.entry as number,
        date: r.entry_date as string,
        year: r.year as number,
        number: r.number as number,
        reference: r.reference as string | null,
        description: r.description as string | null,
        memo: r.memo as string | null,
        amount: r.amount as number,
        baseAmount: r.base_amount as number,
        rate: r.rate as string | null,
        balance: r.balance as number,
        other: r.other_count === 1 ? (r.other as number) : null,
        otherCount: r.other_count as number,
      })),
    }
  },
)
