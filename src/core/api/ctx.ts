import * as z from 'zod/mini'
import type { Db, Row, Statement, Value } from '../db.ts'
import { ApiError } from './errors.ts'

export type Ctx = {
  db: Db
  /** actors.id of the caller. System (1) while no member is signed in; only the open ops run then. */
  actor: number
  /** True while no member is signed in. */
  locked: boolean
  /** Epoch ms from the API clock (injected in tests). */
  now(): number
  /** Binds this member as the actor from the next call. Only `members.signIn` and `setup.run` use it. */
  bind(member: number): void
  /** The op's one write: its statements plus the activity_log row, in one transaction. `actor` overrides who the log row names. */
  write(statements: Statement[], summary?: string | null, actor?: number): Promise<void>
}

export type Op<S extends z.ZodMiniType = z.ZodMiniType, O = unknown> = {
  input: S
  write: boolean
  /** The op writes its own failure rows (counter plus activity_log), so call() does not log one more. */
  selfLog?: boolean
  run(ctx: Ctx, input: z.output<S>): Promise<O>
}

export const read = <S extends z.ZodMiniType, O>(input: S, run: (ctx: Ctx, input: z.output<S>) => Promise<O>): Op<S, O> =>
  ({ input, write: false, run })
/** A write op that logs its own failures (see `Op.selfLog`). */
export const writeSelfLog = <S extends z.ZodMiniType, O>(input: S, run: (ctx: Ctx, input: z.output<S>) => Promise<O>): Op<S, O> =>
  ({ input, write: true, selfLog: true, run })
export const write = <S extends z.ZodMiniType, O>(input: S, run: (ctx: Ctx, input: z.output<S>) => Promise<O>): Op<S, O> =>
  ({ input, write: true, run })

// Shared input pieces.
export const id = z.int().check(z.minimum(1))
/** A PIN: exactly 6 digits. */
export const pin = z.string().check(z.regex(/^\d{6}$/))
export const date = z.iso.date()
export const name = z.string().check(z.trim(), z.minLength(1), z.maxLength(200))
export const text = z.nullable(z.string().check(z.trim(), z.maxLength(1000)))
export const rate = z.string().check(z.regex(/^\d+(\.\d+)?$/), z.refine((r) => /[1-9]/.test(r), 'rate must be > 0'))
export const currency = z.string().check(z.regex(/^[A-Z]{3}$/))
/** Account owner filter: a member id, `shared` (no owner), or left out for the whole family. */
export const owner = z.optional(z.union([id, z.literal('shared')]))
export type OwnerFilter = z.output<typeof owner>
/** SQL for `owner` on an accounts alias, with its params; empty when the whole family is wanted. */
export function ownerSql(o: OwnerFilter, col = 'a.owner_id'): { sql: string; params: Value[] } {
  if (o === undefined) return { sql: '', params: [] }
  return o === 'shared' ? { sql: ` AND ${col} IS NULL`, params: [] } : { sql: ` AND ${col} = ?`, params: [o] }
}
export const paging = {
  page: z.optional(z.int().check(z.minimum(0))),
  pageSize: z.optional(z.int().check(z.minimum(1), z.maximum(1000))),
}
export const limits = (p: { page?: number; pageSize?: number }) => {
  const size = p.pageSize ?? 50
  return { limit: size, offset: (p.page ?? 0) * size }
}

/** One row or null. */
export async function one(db: Db, sql: string, params: Value[] = []): Promise<Row | null> {
  return (await db.query(sql, params))[0] ?? null
}

/** One row or ApiError(code). */
export async function need(db: Db, code: string, sql: string, params: Value[] = []): Promise<Row> {
  return (await one(db, sql, params)) ?? fail(code)
}

export function fail(code: string, details?: unknown): never {
  throw new ApiError(code, details)
}

/** INSERT with the actor columns. Keys come from code, never from input. */
export function insert(ctx: Ctx, table: string, row: Record<string, Value>): Statement {
  const r = { ...row, created_by: ctx.actor, updated_by: ctx.actor }
  const cols = Object.keys(r)
  return { sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, params: Object.values(r) }
}

/** UPDATE one row by id, stamping updated_at and updated_by (and deleted_by with a soft delete). */
export function update(ctx: Ctx, table: string, rowId: number, set: Record<string, Value>): Statement {
  const r = { ...set, ...(set.deleted_at != null && { deleted_by: ctx.actor }), updated_at: ctx.now(), updated_by: ctx.actor }
  const cols = Object.keys(r)
  return { sql: `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, params: [...Object.values(r), rowId] }
}

/** Shared data an admin can let a member change. */
export type Grant = 'accounts' | 'rates' | 'contacts'

/** ApiError('permission_denied') unless the caller is an admin or holds the grant. The DB triggers check it again. */
export async function needGrant(ctx: Ctx, grant: Grant): Promise<void> {
  const ok = await one(ctx.db, `SELECT 1 FROM actors WHERE id = ? AND (kind <> 'user' OR role = 'admin' OR can_manage_${grant} = 1)`, [ctx.actor])
  if (!ok) fail('permission_denied', { grant })
}

/** ApiError('admin_only') unless the caller is an admin. The DB triggers check it again. */
export async function needAdmin(ctx: Ctx): Promise<void> {
  if (!(await one(ctx.db, `SELECT 1 FROM actors WHERE id = ? AND role = 'admin'`, [ctx.actor]))) fail('admin_only')
}

export async function baseCurrency(db: Db): Promise<{ code: string; minor: number }> {
  const r = await need(db, 'not_setup',
    `SELECT c.code, c.minor_unit FROM settings s JOIN currencies c ON c.code = s.value WHERE s.key = 'base_currency'`)
  return { code: r.code as string, minor: r.minor_unit as number }
}
