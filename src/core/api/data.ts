import * as z from 'zod/mini'
import type { Row, Value } from '../db.ts'
import { read } from './ctx.ts'
// Used only inside the op, after index.ts has loaded: the import cycle is safe.
import { API_VERSION } from './index.ts'

// Tables in reference order. Column names stay as in the database; integer ids become uids
// (currency ids become ISO codes), so the file needs no internal ids.
const TABLES = ['actors', 'settings', 'fx_rates', 'accounts', 'entries', 'lines', 'audit_log', 'activity_log'] as const
const WITH_UID = ['actors', 'settings', 'fx_rates', 'accounts', 'entries', 'lines']

/** Every row of every table, for an archive. There is no import: a restore uses an SQLite backup. */
export const exportAll = read(z.object({}), async (ctx) => {
  const [{ user_version }] = await ctx.db.query('PRAGMA user_version')
  const currency = new Map((await ctx.db.query('SELECT id, code FROM currencies')).map((r) => [r.id, r.code]))
  const uidOf: Record<string, Map<Value, Value>> = {}
  for (const t of WITH_UID) uidOf[t] = new Map((await ctx.db.query(`SELECT id, uid FROM ${t}`)).map((r) => [r.id, r.uid]))

  const ref = (table: string, id: Value) => (id === null ? null : (uidOf[table].get(id) ?? null))
  const json = (v: Value) => (v === null ? null : (JSON.parse(v as string) as unknown))

  const map = (table: string, r: Row) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(r)) {
      if (k === 'id' && WITH_UID.includes(table)) continue
      if (k === 'created_by' || k === 'updated_by') out[k] = ref('actors', v)
      else if (k === 'actor_id') out.actor = ref('actors', v)
      else if (k === 'currency_id') out.currency = currency.get(v) ?? null
      else if (k === 'parent_id') out.parent = ref('accounts', v)
      else if (k === 'account_id') out.account = ref('accounts', v)
      else if (k === 'entry_id') out.entry = ref('entries', v)
      else if (k === 'row_id') out.row = WITH_UID.includes(r.table_name as string) ? ref(r.table_name as string, v) : v
      else if (table === 'audit_log' && (k === 'old' || k === 'new')) out[k] = json(v)
      else out[k] = v
    }
    return out
  }

  const tables: Record<string, Record<string, unknown>[]> = {}
  for (const t of TABLES) tables[t] = (await ctx.db.query(`SELECT * FROM ${t} ORDER BY id`)).map((r) => map(t, r))
  return { format: 'aa-finance', apiVersion: API_VERSION, schemaVersion: Number(user_version), exportedAt: new Date().toISOString(), tables }
})
