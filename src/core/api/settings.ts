import * as z from 'zod/mini'
import { COUNTRY_CURRENCY } from '../countries.ts'
import { setupStatements } from '../setup.ts'
import { currency, date, fail, name, need, needAdmin, one, read, update, write } from './ctx.ts'

const country = z.string().check(z.refine((c) => c in COUNTRY_CURRENCY, 'unknown country'))
export const color = z.string().check(z.regex(/^[a-z]{1,20}$/))

export const setup = write(
  z.object({
    baseCurrency: currency,
    language: z.enum(['tr', 'en']),
    userName: name,
    recommended: z.boolean(),
    country: z.optional(country),
    groupName: z.optional(name),
    color: z.optional(color),
    members: z.optional(z.array(name).check(z.maxLength(50))),
  }),
  async (ctx, input) => {
    if (await one(ctx.db, `SELECT 1 FROM settings WHERE key = 'base_currency'`)) fail('already_setup')
    const names = [input.userName, ...(input.members ?? [])].map((n) => n.toLocaleLowerCase())
    if (new Set(names).size !== names.length) fail('member_name_taken')
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

export type Settings = {
  baseCurrency: string
  language: 'tr' | 'en'
  lockDate: string | null
  activityLogDays: number
  userName: string
  groupName: string
  country: string | null
  /** The caller. */
  me: { uid: string; role: 'admin' | 'member'; color: string | null }
}

export const get = read(z.object({}), async (ctx): Promise<Settings> => {
  const user = await need(ctx.db, 'not_setup', 'SELECT uid, name, role, color FROM actors WHERE id = ?', [ctx.actor])
  const rows = await ctx.db.query(
    `SELECT key, value FROM settings WHERE key IN ('base_currency', 'language', 'lock_date', 'activity_log_days', 'group_name', 'country')`)
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  if (!v.base_currency) fail('not_setup')
  return {
    baseCurrency: v.base_currency as string,
    language: v.language as Settings['language'],
    lockDate: (v.lock_date as string | null) ?? null,
    activityLogDays: Number(v.activity_log_days),
    userName: user.name as string,
    groupName: (v.group_name as string | null) ?? (user.name as string),
    country: (v.country as string | null) ?? null,
    me: { uid: user.uid as string, role: user.role as 'admin' | 'member', color: (user.color as string | null) ?? null },
  }
})

export const set = write(
  // Every field but userName is a book setting: admin only.
  z.object({
    language: z.optional(z.enum(['tr', 'en'])),
    lockDate: z.optional(z.nullable(date)),
    activityLogDays: z.optional(z.int().check(z.minimum(1))),
    /** The caller's own name. */
    userName: z.optional(name),
    groupName: z.optional(name),
    country: z.optional(z.nullable(country)),
  }),
  async (ctx, input) => {
    // Only the caller's own name is open to a member. The settings_admin trigger checks it again.
    const { userName, ...book } = input
    if (Object.values(book).some((v) => v !== undefined)) await needAdmin(ctx)
    const values: [string, string | null | undefined][] = [
      ['language', input.language],
      ['lock_date', input.lockDate],
      ['activity_log_days', input.activityLogDays?.toString()],
      ['group_name', input.groupName],
      ['country', input.country],
    ]
    const rows = await ctx.db.query('SELECT key, uid FROM settings')
    const uidOf = new Map(rows.map((r) => [r.key, r.uid as string]))
    const statements = values
      .filter(([, v]) => v !== undefined)
      .map(([key, v]) => update(ctx, 'settings', uidOf.get(key) ?? fail('not_setup'), { value: v ?? null }))
    if (input.userName !== undefined) {
      values.push(['user_name', input.userName])
      statements.push({ sql: 'UPDATE actors SET name = ?, updated_at = ?, updated_by = ? WHERE id = ?', params: [input.userName, Date.now(), ctx.actor, ctx.actor] })
    }
    if (statements.length) await ctx.write(statements, values.filter(([, v]) => v !== undefined).map(([k]) => k).join(', '))
    return {}
  },
)

export const currencies = read(z.object({}), async (ctx) => {
  const rows = await ctx.db.query('SELECT code, name, minor_unit FROM currencies ORDER BY code')
  return rows.map((r) => ({ code: r.code as string, name: r.name as string, minorUnit: r.minor_unit as number }))
})
