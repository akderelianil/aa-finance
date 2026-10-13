import * as z from 'zod/mini'
import { hashPin, verifyPin } from '../pin.ts'
import { memberColor } from '../setup.ts'
import { fail, insert, name, need, needAdmin, one, pin, read, id, update, write, writeSelfLog, type Ctx } from './ctx.ts'
import { color } from './settings.ts'

export type Grants = { accounts: boolean; rates: boolean; contacts: boolean }
export type Member = { id: number; name: string; role: 'admin' | 'member'; color: string | null; me: boolean; hasPin: boolean; grants: Grants }

const role = z.enum(['admin', 'member'])
const grants = z.object({ accounts: z.optional(z.boolean()), rates: z.optional(z.boolean()), contacts: z.optional(z.boolean()) })

/** `accounts=1 rates=0` for the activity log; empty without grants. */
const grantSummary = (g: z.infer<typeof grants> | undefined): string =>
  Object.entries(grantColumns(g)).map(([col, v]) => `${col.replace('can_manage_', '')}=${v}`).join(' ')

/** Grant input -> actors columns. */
const grantColumns = (g: z.infer<typeof grants> | undefined): Record<string, number> =>
  Object.fromEntries(
    (['accounts', 'rates', 'contacts'] as const).filter((k) => g?.[k] !== undefined).map((k) => [`can_manage_${k}`, g![k] ? 1 : 0]))

export const list = read(z.object({}), async (ctx): Promise<Member[]> => {
  const rows = await ctx.db.query(
    `SELECT a.id, a.name, a.role, a.color, p.id IS NOT NULL AS has_pin, a.can_manage_accounts, a.can_manage_rates, a.can_manage_contacts FROM actors a
     LEFT JOIN member_pins p ON p.member_id = a.id AND p.deleted_at IS NULL
     WHERE a.kind = 'user' AND a.deleted_at IS NULL ORDER BY a.id`)
  return rows.map((r) => ({
    id: r.id as number, name: r.name as string, role: r.role as Member['role'], color: (r.color as string | null) ?? null, me: r.id === ctx.actor, hasPin: r.has_pin === 1,
    grants: r.role === 'admin' ? { accounts: true, rates: true, contacts: true }
      : { accounts: r.can_manage_accounts === 1, rates: r.can_manage_rates === 1, contacts: r.can_manage_contacts === 1 },
  }))
})

async function nameFree(ctx: Parameters<typeof list.run>[0], value: string, except: number | null = null) {
  const taken = await one(ctx.db,
    `SELECT 1 FROM actors WHERE kind = 'user' AND deleted_at IS NULL AND lower(name) = lower(?) AND id IS NOT ?`, [value, except])
  if (taken) fail('member_name_taken')
}

/** Admin only. */
export const add = write(z.object({ name, role: z.optional(role), color: z.optional(color), grants: z.optional(grants) }), async (ctx, input) => {
  await needAdmin(ctx)
  await nameFree(ctx, input.name)
  const [{ n }] = await ctx.db.query(`SELECT count(*) AS n FROM actors WHERE kind = 'user'`)
  await ctx.write([insert(ctx, 'actors', {
    kind: 'user', name: input.name, role: input.role ?? 'member', color: input.color ?? memberColor(Number(n)), ...grantColumns(input.grants),
  })], [input.name, grantSummary(input.grants)].filter(Boolean).join(' '))
  return { id: Number((await ctx.db.query('SELECT max(id) AS id FROM actors'))[0].id) }
})

/** Own name and color: anyone. Another member, or any role: admin only. */
export const edit = write(
  z.object({ id, name: z.optional(name), role: z.optional(role), color: z.optional(color), grants: z.optional(grants) }),
  async (ctx, input) => {
    const m = await need(ctx.db, 'member_not_found',
      `SELECT id, role FROM actors WHERE id = ? AND kind = 'user' AND deleted_at IS NULL`, [input.id])
    if (m.id !== ctx.actor || (input.role !== undefined && input.role !== m.role) || input.grants !== undefined) await needAdmin(ctx)
    if (input.name !== undefined) await nameFree(ctx, input.name, input.id)
    // Demoting an admin drops the old grants unless new ones come with it.
    const demoted = input.role === 'member' && m.role === 'admin' && input.grants === undefined
    const set: Record<string, string | number> = demoted ? grantColumns({ accounts: false, rates: false, contacts: false }) : grantColumns(input.grants)
    for (const [key, value] of Object.entries({ name: input.name, role: input.role, color: input.color })) if (value !== undefined) set[key] = value
    if (Object.keys(set).length) await ctx.write([update(ctx, 'actors', input.id, set)], [input.id, grantSummary(input.grants)].filter(Boolean).join(' '))
    return {}
  },
)

// PIN gate. App gate, not encryption (docs/pin-gate.md). Wrong tries are counted in member_pins, so a restart keeps them.
const MAX_TRIES = 5
const WAIT_MS = 30_000

type PinRow = { id: number; hash: string; salt: string; iterations: number; failed: number; waitUntil: number | null }

async function pinOf(ctx: Ctx, member: number): Promise<PinRow | null> {
  const r = await one(ctx.db,
    'SELECT id, hash, salt, iterations, failed_count, wait_until FROM member_pins WHERE member_id = ? AND deleted_at IS NULL', [member])
  return r && { id: r.id as number, hash: r.hash as string, salt: r.salt as string, iterations: r.iterations as number,
    failed: r.failed_count as number, waitUntil: (r.wait_until as number | null) ?? null }
}

/** pin_wait with the seconds left, before any PIN is checked. */
function checkWait(ctx: Ctx, row: PinRow) {
  const left = (row.waitUntil ?? 0) - ctx.now()
  if (left > 0) fail('pin_wait', { seconds: Math.ceil(left / 1000) })
}

/** Counts a wrong try and fails. The counter and the log row commit here, so the failed call cannot roll them back. */
async function wrongPin(ctx: Ctx, row: PinRow, member: number, operation: string): Promise<never> {
  const count = row.failed + 1
  const wait = count >= MAX_TRIES
  const code = wait ? 'pin_wait' : 'pin_wrong'
  await ctx.db.batch([
    { sql: 'UPDATE member_pins SET failed_count = ?, wait_until = ? WHERE id = ?',
      params: [wait ? 0 : count, wait ? ctx.now() + WAIT_MS : null, row.id] },
    { sql: 'INSERT INTO activity_log (actor_id, operation, summary, ok, error_code) VALUES (?, ?, ?, 0, ?)',
      params: [member, operation, null, code] },
  ])
  return fail(code, wait ? { seconds: WAIT_MS / 1000 } : { triesLeft: MAX_TRIES - count })
}

const live = (ctx: Ctx, member: number) =>
  need(ctx.db, 'member_not_found', `SELECT id FROM actors WHERE id = ? AND kind = 'user' AND deleted_at IS NULL`, [member])

/** Open op. Checks the PIN and binds the member as the actor. The member has no PIN yet: pin_not_set (use setPin). */
export const signIn = writeSelfLog(z.object({ id, pin }), async (ctx, input) => {
  await live(ctx, input.id)
  const row = (await pinOf(ctx, input.id)) ?? fail('pin_not_set')
  checkWait(ctx, row)
  if (!(await verifyPin(input.pin, row))) await wrongPin(ctx, row, input.id, 'members.signIn')
  await ctx.db.batch([
    { sql: 'UPDATE member_pins SET failed_count = 0, wait_until = NULL WHERE id = ? AND (failed_count <> 0 OR wait_until IS NOT NULL)', params: [row.id] },
    { sql: 'INSERT INTO activity_log (actor_id, operation, summary, ok) VALUES (?, ?, ?, 1)', params: [input.id, 'members.signIn', null] },
  ])
  ctx.bind(input.id)
  return {}
})

/**
 * Open op. No PIN yet: sets it, no `current` needed (whoever picks the member first sets it; accepted for a family device).
 * A PIN exists: needs `current` and counts wrong tries like signIn. A signed-in member can only change their own.
 * Does not sign in.
 */
export const setPin = writeSelfLog(z.object({ id, pin, current: z.optional(pin) }), async (ctx, input) => {
  await live(ctx, input.id)
  if (!ctx.locked && input.id !== ctx.actor) fail('pin_not_own')
  const row = await pinOf(ctx, input.id)
  const h = await hashPin(input.pin)
  if (!row) {
    await ctx.write([{
      sql: 'INSERT INTO member_pins (created_by, updated_by, member_id, hash, salt, iterations) VALUES (?, ?, ?, ?, ?, ?)',
      params: [input.id, input.id, input.id, h.hash, h.salt, h.iterations],
    }], 'set', input.id)
    return {}
  }
  if (input.current === undefined) fail('pin_current_required')
  checkWait(ctx, row)
  if (!(await verifyPin(input.current, row))) await wrongPin(ctx, row, input.id, 'members.setPin')
  await ctx.write([{
    sql: `UPDATE member_pins SET hash = ?, salt = ?, iterations = ?, failed_count = 0, wait_until = NULL,
          updated_at = ?, updated_by = ? WHERE id = ?`,
    params: [h.hash, h.salt, h.iterations, ctx.now(), input.id, row.id],
  }], 'change', input.id)
  return {}
})

/** Admin only, another member only (use setPin to change your own). Clears the PIN and the counter; the member sets a new one at next sign-in. */
export const resetPin = write(z.object({ id }), async (ctx, input) => {
  await needAdmin(ctx)
  if (input.id === ctx.actor) fail('pin_reset_self')
  await live(ctx, input.id)
  const row = await pinOf(ctx, input.id)
  const now = ctx.now()
  await ctx.write(
    row ? [{ sql: 'UPDATE member_pins SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ?',
      params: [now, ctx.actor, now, ctx.actor, row.id] }] : [],
    `reset ${input.id}`)
  return {}
})

/**
 * Admin only, another member only. Soft deletes the member and their PIN. Their entries stay and keep their author.
 * The last admin stays (trigger `last_admin`).
 */
export const remove = write(z.object({ id }), async (ctx, input) => {
  await needAdmin(ctx)
  if (input.id === ctx.actor) fail('member_remove_self')
  await live(ctx, input.id)
  const pinRow = await pinOf(ctx, input.id)
  const now = ctx.now()
  await ctx.write(
    [
      ...(pinRow ? [{ sql: 'UPDATE member_pins SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE id = ?',
        params: [now, ctx.actor, now, ctx.actor, pinRow.id] }] : []),
      update(ctx, 'actors', input.id, { deleted_at: now, ...grantColumns({ accounts: false, rates: false, contacts: false }) }),
    ],
    String(input.id))
  return {}
})
