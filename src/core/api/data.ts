import * as z from 'zod/mini'
import type { Row, Value } from '../db.ts'
import { read } from './ctx.ts'
// Used only inside the op, after index.ts has loaded: the import cycle is safe.
import { API_VERSION } from './index.ts'

// Tables in reference order. Column names and ids stay as in the database; currency ids become ISO codes.
const TABLES = ['actors', 'settings', 'fx_rates', 'accounts', 'entries', 'lines', 'contacts', 'brand_businesses', 'audit_log', 'activity_log'] as const

/** Every row of every table, for an archive. There is no import: a restore uses an SQLite backup. */
export const exportAll = read(z.object({}), async (ctx) => {
  const [{ user_version }] = await ctx.db.query('PRAGMA user_version')
  const currency = new Map((await ctx.db.query('SELECT id, code FROM currencies')).map((r) => [r.id, r.code]))
  const json = (v: Value) => (v === null ? null : (JSON.parse(v as string) as unknown))

  const map = (table: string, r: Row) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(r)) {
      if (k === 'currency_id') out.currency = currency.get(v) ?? null
      else if (table === 'audit_log' && (k === 'old' || k === 'new')) out[k] = json(v)
      else out[k] = v
    }
    return out
  }

  const tables: Record<string, Record<string, unknown>[]> = {}
  for (const t of TABLES) tables[t] = (await ctx.db.query(`SELECT * FROM ${t} ORDER BY id`)).map((r) => map(t, r))
  return { format: 'aa-finance', apiVersion: API_VERSION, schemaVersion: Number(user_version), exportedAt: new Date().toISOString(), tables }
})
