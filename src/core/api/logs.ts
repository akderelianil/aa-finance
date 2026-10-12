import * as z from 'zod/mini'
import { limits, need, paging, read, uid } from './ctx.ts'

/** Who did what, newest first. */
export const activity = read(z.object({ ...paging }), async (ctx, input) => {
  const { limit, offset } = limits(input)
  const [{ total }] = await ctx.db.query('SELECT count(*) AS total FROM activity_log')
  const rows = await ctx.db.query(
    `SELECT g.at, a.name AS actor, g.operation, g.summary, g.ok, g.error_code, g.duration_ms
     FROM activity_log g JOIN actors a ON a.id = g.actor_id ORDER BY g.id DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  )
  return {
    total: total as number,
    rows: rows.map((r) => ({
      at: r.at as number, actor: r.actor as string, operation: r.operation as string, summary: r.summary as string | null,
      ok: r.ok === 1, errorCode: r.error_code as string | null, durationMs: r.duration_ms as number | null,
    })),
  }
})

/** Who changed this row: every audit_log row, oldest first. */
export const audit = read(
  z.object({ table: z.enum(['actors', 'settings', 'fx_rates', 'accounts', 'entries', 'lines']), uid }),
  async (ctx, input) => {
    // table is from the enum, never free text.
    const row = await need(ctx.db, 'row_not_found', `SELECT id FROM ${input.table} WHERE uid = ?`, [input.uid])
    const rows = await ctx.db.query(
      `SELECT g.at, a.name AS actor, g.op, g.old, g.new FROM audit_log g JOIN actors a ON a.id = g.actor_id
       WHERE g.table_name = ? AND g.row_id = ? ORDER BY g.id`,
      [input.table, row.id],
    )
    const json = (v: unknown) => (v === null ? null : (JSON.parse(v as string) as Record<string, unknown>))
    return rows.map((r) => ({ at: r.at as number, actor: r.actor as string, op: r.op as string, old: json(r.old), new: json(r.new) }))
  },
)
