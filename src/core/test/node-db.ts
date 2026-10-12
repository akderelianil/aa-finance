// Test-only Db on node:sqlite. Same contract as the Rust side (src-tauri/src/db.rs).
import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import type { Db, Row, Value } from '../db.ts'

export function openNodeDb(path = ':memory:'): Db & { close(): void } {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  const run = (sql: string, params?: Value[]) =>
    params?.length ? db.prepare(sql).run(...(params as SQLInputValue[])) : db.exec(sql)
  return {
    close: () => db.close(),
    async query(sql, params = []) {
      // Spread: node:sqlite rows have a null prototype; the app's rows are plain objects.
      return db.prepare(sql).all(...(params as SQLInputValue[])).map((r) => ({ ...r }) as Row)
    },
    async batch(statements) {
      db.exec('BEGIN')
      try {
        for (const s of statements) run(s.sql, s.params)
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  }
}

/** Reads src/core/migrations/*.sql in name order. The app does the same with import.meta.glob. */
export function readMigrations(): string[] {
  const dir = new URL('../migrations/', import.meta.url)
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(new URL(f, dir), 'utf8'))
}
