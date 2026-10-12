import * as z from 'zod/mini'
import type { Db, Row, Statement, Value } from '../db.ts'
import { ApiError } from './errors.ts'

export type Ctx = {
  db: Db
  /** actors.id of the caller. */
  actor: number
  /** The op's one write: its statements plus the activity_log row, in one transaction. */
  write(statements: Statement[], summary?: string | null): Promise<void>
}

export type Op<S extends z.ZodMiniType = z.ZodMiniType, O = unknown> = {
  input: S
  write: boolean
  run(ctx: Ctx, input: z.output<S>): Promise<O>
}

export const read = <S extends z.ZodMiniType, O>(input: S, run: (ctx: Ctx, input: z.output<S>) => Promise<O>): Op<S, O> =>
  ({ input, write: false, run })
export const write = <S extends z.ZodMiniType, O>(input: S, run: (ctx: Ctx, input: z.output<S>) => Promise<O>): Op<S, O> =>
  ({ input, write: true, run })

// Shared input pieces.
export const id = z.int().check(z.minimum(1))
export const date = z.iso.date()
export const name = z.string().check(z.trim(), z.minLength(1), z.maxLength(200))
export const text = z.nullable(z.string().check(z.trim(), z.maxLength(1000)))
export const rate = z.string().check(z.regex(/^\d+(\.\d+)?$/), z.refine((r) => /[1-9]/.test(r), 'rate must be > 0'))
export const currency = z.string().check(z.regex(/^[A-Z]{3}$/))
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

/** Tables whose audit_log insert row already names the creator: they have updated_by only. */
const NO_CREATED = ['settings', 'fx_rates']

/** INSERT with the actor columns. Keys come from code, never from input. */
export function insert(ctx: Ctx, table: string, row: Record<string, Value>): Statement {
  const r = { ...row, ...(!NO_CREATED.includes(table) && { created_by: ctx.actor }), updated_by: ctx.actor }
  const cols = Object.keys(r)
  return { sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, params: Object.values(r) }
}

/** UPDATE one row by id, stamping updated_at and updated_by. */
export function update(ctx: Ctx, table: string, rowId: number, set: Record<string, Value>): Statement {
  const r = { ...set, updated_at: Date.now(), updated_by: ctx.actor }
  const cols = Object.keys(r)
  return { sql: `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, params: [...Object.values(r), rowId] }
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
