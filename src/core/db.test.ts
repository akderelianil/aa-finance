import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migrate } from './migrate.ts'
import { openNodeDb, readMigrations } from './test/node-db.ts'

test('migrate applies all files once and sets user_version', async () => {
  const db = openNodeDb()
  const migrations = readMigrations()
  assert.equal(await migrate(db, migrations), migrations.length)
  assert.equal(await migrate(db, migrations), migrations.length)
  const [{ user_version }] = await db.query('PRAGMA user_version')
  assert.equal(user_version, migrations.length)
})

test('migrate refuses a database newer than the app', async () => {
  const db = openNodeDb()
  await db.batch([{ sql: 'PRAGMA user_version = 99' }])
  await assert.rejects(migrate(db, readMigrations()), /newer than the app/)
})

test('batch rolls back every statement on error', async () => {
  const db = openNodeDb()
  await migrate(db, readMigrations())
  await assert.rejects(
    db.batch([
      { sql: 'INSERT INTO spike (amount) VALUES (?)', params: [100] },
      { sql: 'INSERT INTO spike (amount) VALUES (?)', params: [null] },
    ]),
  )
  assert.deepEqual(await db.query('SELECT count(*) AS n FROM spike'), [{ n: 0 }])
})

test('integers round-trip up to the safe limit and fail above it', async () => {
  const db = openNodeDb()
  await migrate(db, readMigrations())
  const max = Number.MAX_SAFE_INTEGER
  await db.batch([{ sql: 'INSERT INTO spike (amount) VALUES (?), (?)', params: [max, -max] }])
  const rows = await db.query('SELECT amount FROM spike ORDER BY id')
  assert.deepEqual(rows.map((r) => r.amount), [max, -max])
  await assert.rejects(db.query('SELECT amount + 1 AS a FROM spike WHERE amount > 0'), /too large/)
})
