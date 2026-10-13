// The API: named JSON operations, the only way the UI (and later plugins) reads or writes.
// call() gates on the signed-in member, validates the input, writes activity_log for writes and turns any error into ApiError.
import * as z from 'zod/mini'
import type { Db } from '../db.ts'
import * as accounts from './accounts.ts'
import * as contacts from './contacts.ts'
import { one, type Ctx, type Op } from './ctx.ts'
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
  'settings.groupName': settings.groupName,
  'settings.update': settings.set,
  'currencies.list': settings.currencies,
  'members.list': members.list,
  'members.add': members.add,
  'members.update': members.edit,
  'members.remove': members.remove,
  'members.signIn': members.signIn,
  'members.setPin': members.setPin,
  'members.resetPin': members.resetPin,
  'contacts.list': contacts.list,
  'contacts.balances': contacts.balances,
  'contacts.create': contacts.create,
  'contacts.update': contacts.edit,
  'contacts.delete': contacts.remove,
  'fx.list': fx.list,
  'fx.get': fx.get,
  'fx.set': fx.set,
  'fx.delete': fx.remove,
  'accounts.list': accounts.list,
  'accounts.usage': accounts.usage,
  'accounts.create': accounts.create,
  'accounts.update': accounts.edit,
  'accounts.archive': accounts.archive,
  'accounts.delete': accounts.remove,
  'accounts.register': accounts.register,
  'entries.post': entries.post,
  'entries.update': entries.edit,
  'entries.delete': entries.remove,
  'entries.deleteAll': entries.removeAll,
  'entries.get': entries.get,
  'entries.list': entries.list,
  'reports.trialBalance': reports.trialBalance,
  'reports.balanceSheet': reports.balanceSheet,
  'reports.incomeStatement': reports.incomeStatement,
  'activity.list': logs.activity,
  'audit.forRow': logs.audit,
} satisfies Record<string, Op>

export type OpName = keyof typeof ops
export type Input<K extends OpName> = z.input<(typeof ops)[K]['input']>
export type Output<K extends OpName> = Awaited<ReturnType<(typeof ops)[K]['run']>>

/** Ops that run with no member signed in (before setup, or locked). Everything else fails with `locked`. */
export const openOps: ReadonlySet<OpName> = new Set<OpName>(['setup.run', 'currencies.list', 'members.list', 'settings.groupName', 'members.signIn', 'members.setPin'])

export type Api = {
  call<K extends OpName>(op: K, input: Input<K>): Promise<Output<K>>
  /** Clears the bound member: every op except the open ones fails with `locked` until the next `members.signIn`. */
  lock(): void
}

export type ApiOptions = {
  /** Epoch ms. Tests inject a clock for the PIN wait. */
  now?: () => number
}

/**
 * The API for the whole app. No member is bound at start: `members.signIn` (a good PIN) or `setup.run` binds one;
 * `lock()` clears it. The caller never picks the actor.
 */
export function createApi(db: Db, options: ApiOptions = {}): Api {
  const now = options.now ?? Date.now
  let actor: number | null = null

  // Writes run one after another: an op reads (next id, owner, rate) before it writes, so two at once could race.
  let queue: Promise<unknown> = Promise.resolve()
  const inTurn = <T>(run: () => Promise<T>): Promise<T> => {
    const result = queue.then(run, run)
    queue = result.catch(() => {})
    return result
  }

  const api: Api = {
    lock() {
      actor = null
    },
    call(name, input) {
      const op = ops[name] as Op | undefined
      return op?.write ? inTurn(() => run(name, input)) : run(name, input)
    },
  }
  return api

  async function anyMember() {
    return (await db.query(`SELECT 1 FROM actors WHERE kind = 'user' AND deleted_at IS NULL LIMIT 1`)).length > 0
  }

  async function run<K extends OpName>(name: K, input: Input<K>): Promise<Output<K>> {
    const op = ops[name] as Op
    const start = performance.now()
    const ms = () => Math.round(performance.now() - start)
    let id = actor
    try {
      // A member removed in another window must not keep acting on this session.
      if (id !== null && !(await one(db, 'SELECT 1 FROM actors WHERE id = ? AND deleted_at IS NULL', [id]))) {
        actor = null
        id = null
      }
      if (!op) throw new ApiError('unknown_op', name)
      if (id === null && op && !openOps.has(name)) throw new ApiError(await anyMember() ? 'locked' : 'not_setup')
      const parsed = z.safeParse(op.input, input)
      if (!parsed.success) throw new ApiError('invalid_input', z.flattenError(parsed.error))
      const ctx: Ctx = {
        db,
        actor: id ?? 1,
        locked: id === null,
        now,
        bind: (member) => { actor = member },
        write: (statements, summary = null, by) =>
          db.batch([
            ...statements,
            {
              sql: 'INSERT INTO activity_log (actor_id, operation, summary, ok, duration_ms) VALUES (?, ?, ?, 1, ?)',
              params: [by ?? id ?? 1, name, summary, ms()],
            },
          ]),
      }
      return (await op.run(ctx, parsed.data)) as never
    } catch (e) {
      const err = toApiError(e)
      if (op?.write && !op.selfLog && id !== null)
        await db
          .batch([{
            sql: 'INSERT INTO activity_log (actor_id, operation, ok, error_code, duration_ms) VALUES (?, ?, 0, ?, ?)',
            params: [id, name, err.code, ms()],
          }])
          .catch(() => {})
      throw err
    }
  }
}

export { ApiError }
