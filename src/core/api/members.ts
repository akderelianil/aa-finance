import * as z from 'zod/mini'
import { memberColor } from '../setup.ts'
import { uuidv7 } from '../uuid.ts'
import { fail, insert, name, need, needAdmin, one, read, uid, update, write } from './ctx.ts'
import { color } from './settings.ts'

export type Member = { uid: string; name: string; role: 'admin' | 'member'; color: string | null; me: boolean }

const role = z.enum(['admin', 'member'])

export const list = read(z.object({}), async (ctx): Promise<Member[]> => {
  const rows = await ctx.db.query(
    `SELECT id, uid, name, role, color FROM actors WHERE kind = 'user' AND deleted_at IS NULL ORDER BY id`)
  return rows.map((r) => ({
    uid: r.uid as string, name: r.name as string, role: r.role as Member['role'], color: (r.color as string | null) ?? null, me: r.id === ctx.actor,
  }))
})

async function nameFree(ctx: Parameters<typeof list.run>[0], value: string, except: string | null = null) {
  const taken = await one(ctx.db,
    `SELECT 1 FROM actors WHERE kind = 'user' AND deleted_at IS NULL AND lower(name) = lower(?) AND uid IS NOT ?`, [value, except])
  if (taken) fail('member_name_taken')
}

/** Admin only. */
export const add = write(z.object({ name, role: z.optional(role), color: z.optional(color) }), async (ctx, input) => {
  await needAdmin(ctx)
  await nameFree(ctx, input.name)
  const [{ n }] = await ctx.db.query(`SELECT count(*) AS n FROM actors WHERE kind = 'user'`)
  const newUid = uuidv7()
  await ctx.write([insert(ctx, 'actors', {
    uid: newUid, kind: 'user', name: input.name, role: input.role ?? 'member', color: input.color ?? memberColor(Number(n)),
  })], input.name)
  return { uid: newUid }
})

/** Own name and color: anyone. Another member, or any role: admin only. */
export const edit = write(
  z.object({ uid, name: z.optional(name), role: z.optional(role), color: z.optional(color) }),
  async (ctx, input) => {
    const m = await need(ctx.db, 'member_not_found',
      `SELECT id, role FROM actors WHERE uid = ? AND kind = 'user' AND deleted_at IS NULL`, [input.uid])
    if (m.id !== ctx.actor || (input.role !== undefined && input.role !== m.role)) await needAdmin(ctx)
    if (input.name !== undefined) await nameFree(ctx, input.name, input.uid)
    const set = Object.fromEntries(
      Object.entries({ name: input.name, role: input.role, color: input.color }).filter((e): e is [string, string] => e[1] !== undefined))
    if (Object.keys(set).length) await ctx.write([update(ctx, 'actors', input.uid, set)], input.uid)
    return {}
  },
)
