import * as z from 'zod/mini'
import { setupStatements } from '../setup.ts'
import { currency, date, fail, name, one, read, update, write } from './ctx.ts'

export const setup = write(
  z.object({ baseCurrency: currency, language: z.enum(['tr', 'en']), userName: name, recommended: z.boolean() }),
  async (ctx, input) => {
    if (await one(ctx.db, `SELECT 1 FROM settings WHERE key = 'base_currency'`)) fail('already_setup')
    if (!(await one(ctx.db, 'SELECT 1 FROM currencies WHERE code = ?', [input.baseCurrency]))) fail('currency_unknown')
    const { user, statements } = setupStatements(input)
    // No actor before setup: the new user writes its own activity row.
    statements.push({
      sql: `INSERT INTO activity_log (actor_id, operation, summary, ok) VALUES ((SELECT id FROM actors WHERE uid = ?), 'setup.run', ?, 1)`,
      params: [user, input.baseCurrency],
    })
    await ctx.db.batch(statements)
    return { user }
  },
)

export type Settings = { baseCurrency: string; language: 'tr' | 'en'; lockDate: string | null; activityLogDays: number }

export const get = read(z.object({}), async (ctx): Promise<Settings> => {
  const rows = await ctx.db.query(`SELECT key, value FROM settings WHERE key IN ('base_currency', 'language', 'lock_date', 'activity_log_days')`)
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  if (!v.base_currency) fail('not_setup')
  return {
    baseCurrency: v.base_currency as string,
    language: v.language as Settings['language'],
    lockDate: (v.lock_date as string | null) ?? null,
    activityLogDays: Number(v.activity_log_days),
  }
})

export const set = write(
  z.object({
    language: z.optional(z.enum(['tr', 'en'])),
    lockDate: z.optional(z.nullable(date)),
    activityLogDays: z.optional(z.int().check(z.minimum(1))),
  }),
  async (ctx, input) => {
    const values: [string, string | null | undefined][] = [
      ['language', input.language],
      ['lock_date', input.lockDate],
      ['activity_log_days', input.activityLogDays?.toString()],
    ]
    const rows = await ctx.db.query('SELECT key, uid FROM settings')
    const uidOf = new Map(rows.map((r) => [r.key, r.uid as string]))
    const statements = values
      .filter(([, v]) => v !== undefined)
      .map(([key, v]) => update(ctx, 'settings', uidOf.get(key) ?? fail('not_setup'), { value: v ?? null }))
    if (statements.length) await ctx.write(statements, values.filter(([, v]) => v !== undefined).map(([k]) => k).join(', '))
    return {}
  },
)

export const currencies = read(z.object({}), async (ctx) => {
  const rows = await ctx.db.query('SELECT code, name, minor_unit FROM currencies ORDER BY code')
  return rows.map((r) => ({ code: r.code as string, name: r.name as string, minorUnit: r.minor_unit as number }))
})
