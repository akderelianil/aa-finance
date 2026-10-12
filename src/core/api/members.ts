import * as z from 'zod/mini'
import { memberColor } from '../setup.ts'
import { fail, insert, name, need, needAdmin, one, read, id, update, write } from './ctx.ts'
import { color } from './settings.ts'

export type Member = { id: number; name: string; role: 'admin' | 'member'; color: string | null; me: boolean }

const role = z.enum(['admin', 'member'])

export const list = read(z.object({}), async (ctx): Promise<Member[]> => {
  const rows = await ctx.db.query(
    `SELECT id, name, role, color FROM actors WHERE kind = 'user' AND deleted_at IS NULL ORDER BY id`)
  return rows.map((r) => ({
    id: r.id as number, name: r.name as string, role: r.role as Member['role'], color: (r.color as string | null) ?? null, me: r.id === ctx.actor,
  }))
})

async function nameFree(ctx: Parameters<typeof list.run>[0], value: string, except: number | null = null) {
  const taken = await one(ctx.db,
    `SELECT 1 FROM actors WHERE kind = 'user' AND deleted_at IS NULL AND lower(name) = lower(?) AND id IS NOT ?`, [value, except])
  if (taken) fail('member_name_taken')
}

/** Admin only. */
export const add = write(z.object({ name, role: z.optional(role), color: z.optional(color) }), async (ctx, input) => {
  await needAdmin(ctx)
  await nameFree(ctx, input.name)
  const [{ n }] = await ctx.db.query(`SELECT count(*) AS n FROM actors WHERE kind = 'user'`)
  await ctx.write([insert(ctx, 'actors', {
    kind: 'user', name: input.name, role: input.role ?? 'member', color: input.color ?? memberColor(Number(n)),
  })], input.name)
  return { id: Number((await ctx.db.query('SELECT max(id) AS id FROM actors'))[0].id) }
})

/** Own name and color: anyone. Another member, or any role: admin only. */
export const edit = write(
  z.object({ id, name: z.optional(name), role: z.optional(role), color: z.optional(color) }),
  async (ctx, input) => {
    const m = await need(ctx.db, 'member_not_found',
      `SELECT id, role FROM actors WHERE id = ? AND kind = 'user' AND deleted_at IS NULL`, [input.id])
    if (m.id !== ctx.actor || (input.role !== undefined && input.role !== m.role)) await needAdmin(ctx)
    if (input.name !== undefined) await nameFree(ctx, input.name, input.id)
    const set = Object.fromEntries(
      Object.entries({ name: input.name, role: input.role, color: input.color }).filter((e): e is [string, string] => e[1] !== undefined))
    if (Object.keys(set).length) await ctx.write([update(ctx, 'actors', input.id, set)], String(input.id))
    return {}
  },
)
