// The app's Db: Rust commands over Tauri IPC (src-tauri/src/db.rs).
import { invoke } from '@tauri-apps/api/core'
import type { Db, Row, Value } from '../core/db.ts'

type Result = { columns: string[]; rows: Value[][] }

export const tauriDb: Db = {
  async query(sql, params = []) {
    // Rust sends column names once and rows as arrays: less JSON than one object per row.
    const { columns, rows } = await invoke<Result>('db_query', { sql, params })
    return rows.map((r) => {
      const o: Row = {}
      for (let i = 0; i < columns.length; i++) o[columns[i]] = r[i]
      return o
    })
  },
  async batch(statements) {
    await invoke('db_batch', { statements })
  },
}

/** Migration files, bundled by Vite in name order. */
export const migrations = Object.entries(
  import.meta.glob<string>('../core/migrations/*.sql', { query: '?raw', import: 'default', eager: true }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, sql]) => sql)
