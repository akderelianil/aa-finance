import * as z from 'zod/mini'
import type { AccountType } from '../chart.ts'
import { uuidv7 } from '../uuid.ts'
import { currency, date, insert, limits, name, need, one, paging, read, uid, update, write } from './ctx.ts'

export type Account = {
  uid: string
  parent: string | null
  name: string
  type: AccountType
  currency: string
  code: string | null
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
    `SELECT a.uid, p.uid AS parent, a.name, a.type, c.code AS currency, a.code, a.is_placeholder, a.locked, a.system_key,
            a.archived_at, coalesce(b.amount, 0) AS balance, coalesce(b.base, 0) AS base
     FROM accounts a
     JOIN currencies c ON c.id = a.currency_id
     LEFT JOIN accounts p ON p.id = a.parent_id
     LEFT JOIN (
       SELECT account_id, sum(amount) AS amount, sum(base_amount) AS base FROM lines
       WHERE deleted_at IS NULL AND entry_date <= ? GROUP BY account_id
     ) b ON b.account_id = a.id
     WHERE a.deleted_at IS NULL
     ORDER BY a.id`,
    [input.asOf ?? '9999-12-31'],
  )
  return rows.map((r) => ({
    uid: r.uid as string,
    parent: r.parent as string | null,
    name: r.name as string,
    type: r.type as AccountType,
    currency: r.currency as string,
    code: r.code as string | null,
    placeholder: r.is_placeholder === 1,
    locked: r.locked === 1,
    systemKey: r.system_key as string | null,
    archived: r.archived_at !== null,
    balance: r.balance as number,
    baseBalance: r.base as number,
  }))
})

const code = z.optional(z.nullable(z.string().check(z.trim(), z.minLength(1), z.maxLength(50))))

/** Type comes from the parent. Currency defaults to the base currency. */
export const create = write(
  z.object({ parent: uid, name, currency: z.optional(currency), code, placeholder: z.optional(z.boolean()) }),
  async (ctx, input) => {
    const parent = await need(ctx.db, 'account_not_found', 'SELECT id, type FROM accounts WHERE uid = ? AND deleted_at IS NULL', [input.parent])
    const cur = input.currency
      ? await need(ctx.db, 'currency_unknown', 'SELECT id FROM currencies WHERE code = ?', [input.currency])
      : await need(ctx.db, 'not_setup', `SELECT c.id FROM currencies c JOIN settings s ON s.value = c.code WHERE s.key = 'base_currency'`)
    const rowUid = uuidv7()
    await ctx.write(
      [insert(ctx, 'accounts', {
        uid: rowUid, parent_id: parent.id, name: input.name, type: parent.type, currency_id: cur.id,
        code: input.code ?? null, is_placeholder: input.placeholder ? 1 : 0,
      })],
      `${rowUid} ${input.name}`,
    )
    return { uid: rowUid }
  },
)

export const edit = write(
  z.object({ uid, name: z.optional(name), parent: z.optional(uid), currency: z.optional(currency), code, placeholder: z.optional(z.boolean()) }),
  async (ctx, input) => {
    await live(ctx.db, input.uid)
    const set: Record<string, string | number | null> = {}
    if (input.name !== undefined) set.name = input.name
    if (input.code !== undefined) set.code = input.code
    if (input.placeholder !== undefined) set.is_placeholder = input.placeholder ? 1 : 0
    if (input.parent !== undefined) set.parent_id = (await live(ctx.db, input.parent)).id
    if (input.currency !== undefined)
      set.currency_id = (await need(ctx.db, 'currency_unknown', 'SELECT id FROM currencies WHERE code = ?', [input.currency])).id
    if (Object.keys(set).length) await ctx.write([update(ctx, 'accounts', input.uid, set)], input.uid)
    return {}
  },
)

export const archive = write(z.object({ uid, archived: z.boolean() }), async (ctx, input) => {
  await live(ctx.db, input.uid)
  await ctx.write([update(ctx, 'accounts', input.uid, { archived_at: input.archived ? Date.now() : null })], input.uid)
  return {}
})

/** Soft delete. Only an account without live lines and children (the database checks). */
export const remove = write(z.object({ uid }), async (ctx, input) => {
  await live(ctx.db, input.uid)
  await ctx.write([update(ctx, 'accounts', input.uid, { deleted_at: Date.now() })], input.uid)
  return {}
})

async function live(db: Parameters<typeof need>[0], accountUid: string) {
  return need(db, 'account_not_found', 'SELECT id FROM accounts WHERE uid = ? AND deleted_at IS NULL', [accountUid])
}

export type RegisterRow = {
  line: string
  entry: string
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
  other: string | null
  otherCount: number
}

/** Account register: lines oldest first, paged, with a running balance from `opening`. */
export const register = read(
  z.object({ uid, from: z.optional(date), to: z.optional(date), ...paging }),
  async (ctx, input) => {
    const acc = await live(ctx.db, input.uid)
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
         SELECT l.id, l.uid, l.entry_id, l.position, l.entry_date, l.memo, l.amount, l.base_amount, l.rate,
                sum(l.amount) OVER (ORDER BY l.entry_date, l.entry_id, l.position, l.id) AS run
         FROM lines l
         WHERE l.account_id = ?1 AND l.deleted_at IS NULL AND l.entry_date >= ?2 AND l.entry_date <= ?3
         -- Page here, so the joins and subqueries below run for one page only.
         ORDER BY l.entry_date, l.entry_id, l.position, l.id
         LIMIT ?5 OFFSET ?6
       )
       SELECT r.uid, e.uid AS entry, r.entry_date, e.year, e.number, e.reference, e.description, r.memo,
              r.amount, r.base_amount, r.rate, r.run + ?4 AS balance,
              (SELECT count(*) FROM lines o WHERE o.entry_id = r.entry_id AND o.id <> r.id AND o.deleted_at IS NULL) AS other_count,
              (SELECT a.uid FROM lines o JOIN accounts a ON a.id = o.account_id
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
        line: r.uid as string,
        entry: r.entry as string,
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
        other: r.other_count === 1 ? (r.other as string) : null,
        otherCount: r.other_count as number,
      })),
    }
  },
)
