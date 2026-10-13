import type { Db } from './db.ts'

/**
 * Applies the migrations after PRAGMA user_version, each in its own transaction.
 * `migrations[i]` is file number i+1. Never edit an applied file; add a new one.
 */
export async function migrate(db: Db, migrations: string[]): Promise<number> {
  const [{ user_version }] = await db.query('PRAGMA user_version')
  const from = Number(user_version)
  if (from > migrations.length) throw new Error(`database is newer than the app (v${from} > v${migrations.length})`)
  for (let v = from; v < migrations.length; v++) {
    await db.batch([{ sql: migrations[v] }, { sql: `PRAGMA user_version = ${v + 1}` }])
  }
  return migrations.length
}

/** Deletes activity_log rows older than the `activity_log_days` setting. Before setup there is no setting and nothing goes. */
export async function pruneActivityLog(db: Db): Promise<void> {
  await db.batch([{
    sql: `DELETE FROM activity_log WHERE at < CAST(unixepoch('subsec') * 1000 AS INTEGER)
            - (SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'activity_log_days') * 86400000`,
  }])
}
