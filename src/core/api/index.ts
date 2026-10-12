// The API: named JSON operations, the only way the UI (and later plugins) reads or writes.
// call() validates the input, binds the actor, writes activity_log for writes and turns any error into ApiError.
import * as z from 'zod/mini'
import type { Db } from '../db.ts'
import * as accounts from './accounts.ts'
import type { Ctx, Op } from './ctx.ts'
import * as data from './data.ts'
import * as entries from './entries.ts'
import { ApiError, toApiError } from './errors.ts'
import * as fx from './fx.ts'
import * as logs from './logs.ts'
import * as members from './members.ts'
import * as reports from './reports.ts'
import * as settings from './settings.ts'

export const API_VERSION = 1

export const ops = {
  'setup.run': settings.setup,
  'settings.get': settings.get,
  'settings.update': settings.set,
  'currencies.list': settings.currencies,
  'members.list': members.list,
  'members.add': members.add,
  'members.update': members.edit,
  'fx.list': fx.list,
  'fx.get': fx.get,
  'fx.set': fx.set,
  'fx.delete': fx.remove,
  'accounts.list': accounts.list,
  'accounts.create': accounts.create,
  'accounts.update': accounts.edit,
  'accounts.archive': accounts.archive,
  'accounts.delete': accounts.remove,
  'accounts.register': accounts.register,
  'entries.post': entries.post,
  'entries.update': entries.edit,
  'entries.delete': entries.remove,
  'entries.get': entries.get,
  'entries.list': entries.list,
  'reports.trialBalance': reports.trialBalance,
  'reports.balanceSheet': reports.balanceSheet,
  'reports.incomeStatement': reports.incomeStatement,
  'activity.list': logs.activity,
  'audit.forRow': logs.audit,
  'data.export': data.exportAll,
} satisfies Record<string, Op>

export type OpName = keyof typeof ops
export type Input<K extends OpName> = z.input<(typeof ops)[K]['input']>
export type Output<K extends OpName> = Awaited<ReturnType<(typeof ops)[K]['run']>>

/** Ops that run before setup, without an actor. */
const open = new Set<OpName>(['setup.run', 'currencies.list'])

export type Api = {
  call<K extends OpName>(op: K, input: Input<K>): Promise<Output<K>>
  /** Act as this member from the next call. Unknown or null: the first admin. */
  use(member: number | null): void
}

/** The API for one member: the chosen one, else the first admin, found after setup. */
export function createApi(db: Db, member: number | null = null): Api {
  let actor: number | null = null
  const findActor = async () => {
    const [r] = await db.query(
      `SELECT id FROM actors WHERE kind = 'user' AND deleted_at IS NULL
       ORDER BY id IS NOT ?, role IS NOT 'admin', id LIMIT 1`, [member])
    return (actor = (r?.id as number | undefined) ?? null)
  }

  return {
    use(id) {
      member = id
      actor = null
    },
    async call(name, input) {
      const op = ops[name] as Op
      const start = performance.now()
      const ms = () => Math.round(performance.now() - start)
      const id = actor ?? (await findActor())
      try {
        if (!op) throw new ApiError('unknown_op', name)
        if (id === null && !open.has(name)) throw new ApiError('not_setup')
        const parsed = z.safeParse(op.input, input)
        if (!parsed.success) throw new ApiError('invalid_input', z.flattenError(parsed.error))
        const ctx: Ctx = {
          db,
          actor: id ?? 1,
          write: (statements, summary = null) =>
            db.batch([
              ...statements,
              {
                sql: 'INSERT INTO activity_log (actor_id, operation, summary, ok, duration_ms) VALUES (?, ?, ?, 1, ?)',
                params: [id ?? 1, name, summary, ms()],
              },
            ]),
        }
        return (await op.run(ctx, parsed.data)) as never
      } catch (e) {
        const err = toApiError(e)
        if (op?.write && id !== null)
          await db
            .batch([{
              sql: 'INSERT INTO activity_log (actor_id, operation, ok, error_code, duration_ms) VALUES (?, ?, 0, ?, ?)',
              params: [id, name, err.code, ms()],
            }])
            .catch(() => {})
        throw err
      }
    },
  }
}

export { ApiError }
