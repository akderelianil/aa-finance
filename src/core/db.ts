// The one door to SQLite. The app gets it from Rust (Tauri IPC), tests from node:sqlite.
// Integers are plain numbers: the adapters refuse any value outside the safe integer range.

export type Value = number | string | null
export type Row = Record<string, Value>
export type Statement = { sql: string; params?: Value[] }

export interface Db {
  /** One statement, returns its rows. */
  query(sql: string, params?: Value[]): Promise<Row[]>
  /**
   * All statements in one transaction; any error rolls back all.
   * A statement without params may hold several statements (migrations).
   */
  batch(statements: Statement[]): Promise<void>
}
