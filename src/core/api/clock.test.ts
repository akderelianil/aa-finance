// The API clock: every timestamp a write stamps comes from the injected `now`, and the open-op set stays small.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migrate } from '../migrate.ts'
import { openNodeDb, readMigrations } from '../test/node-db.ts'
import { createApi, ops, openOps, type OpName } from './index.ts'

const NOW = Date.UTC(2031, 0, 2, 3, 4, 5)

async function fresh() {
  const db = openNodeDb()
  await migrate(db, readMigrations())
  const api = createApi(db, { now: () => NOW })
  await api.call('setup.run', { baseCurrency: 'TRY', language: 'en', userName: 'Test', recommended: true })
  const list = await api.call('accounts.list', {})
  const acc = (name: string) => (list.find((a) => a.systemKey === name || a.name === name) ?? assert.fail(`no account ${name}`)).id
  return { api, db, acc }
}

async function stamps(db: ReturnType<typeof openNodeDb>, table: string, id: number) {
  const [row] = await db.query(`SELECT updated_at, deleted_at FROM ${table} WHERE id = ?`, [id])
  return row
}

test('entries.update and entries.delete stamp the injected clock', async () => {
  const { api, db, acc } = await fresh()
  const cash = acc('Wallet')
  const food = acc('Groceries')
  const { id } = await api.call('entries.post', { date: '2026-03-01', lines: [{ account: cash, amount: -500 }, { account: food, amount: 500 }] })
  await api.call('entries.update', { id, description: 'x', lines: [{ account: cash, amount: -700 }, { account: food, amount: 700 }] })
  const [live] = await db.query('SELECT deleted_at, updated_at FROM lines WHERE entry_id = ? ORDER BY id LIMIT 1', [id])
  assert.equal(live.deleted_at, NOW, 'replaced lines are soft deleted at the injected time')
  assert.equal((await stamps(db, 'entries', id)).updated_at, NOW)
  await api.call('entries.delete', { id })
  assert.equal((await stamps(db, 'entries', id)).deleted_at, NOW)
})

test('accounts and settings writes stamp the injected clock', async () => {
  const { api, db, acc } = await fresh()
  const id = acc('Wallet')
  await api.call('accounts.archive', { id, archived: true })
  assert.equal((await db.query('SELECT archived_at FROM accounts WHERE id = ?', [id]))[0].archived_at, NOW)
  await api.call('settings.update', { userName: 'Renamed' })
  const [me] = await db.query(`SELECT updated_at FROM actors WHERE name = 'Renamed'`)
  assert.equal(me.updated_at, NOW)
})

test('only the expected write ops run without a signed-in member', () => {
  // Locked, an open op runs as the system actor. A new write op in the open set must be a conscious choice.
  const openWrites = [...openOps].filter((name: OpName) => ops[name].write).sort()
  assert.deepEqual(openWrites, ['members.setPin', 'members.signIn', 'setup.run'])
})
