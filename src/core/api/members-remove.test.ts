// members.remove: an admin takes another member out of the book; their entries stay.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migrate } from '../migrate.ts'
import { openNodeDb, readMigrations } from '../test/node-db.ts'
import { createApi, type Api } from './index.ts'

const code = (c: string) => (e: unknown) => {
  assert.equal((e as { code?: string }).code, c, String(e))
  return true
}

async function as(api: Api, member: number, pin = '123456') {
  api.lock()
  if (!(await api.call('members.list', {})).find((m) => m.id === member)?.hasPin) await api.call('members.setPin', { id: member, pin })
  await api.call('members.signIn', { id: member, pin })
}

async function book() {
  const db = openNodeDb()
  await migrate(db, readMigrations())
  const api = createApi(db)
  await api.call('setup.run', { baseCurrency: 'TRY', language: 'en', userName: 'Anil', recommended: true, members: ['Ece', 'Can'] })
  const [admin, ece, can] = await api.call('members.list', {})
  return { api, db, admin, ece, can }
}

test('members.remove: admin only, another member only, entries and history stay', async () => {
  const { api, db, admin, ece, can } = await book()
  const accounts = await api.call('accounts.list', {})
  const acc = (key: string) => accounts.find((a) => a.systemKey === key || a.name === key)!.id
  await as(api, ece.id)
  const { id: entry } = await api.call('entries.post', { date: '2026-01-03', lines: [{ account: acc('Wallet'), amount: 7 }, { account: acc('opening_balance'), amount: -7 }] })

  await assert.rejects(api.call('members.remove', { id: can.id }), code('admin_only'))
  await as(api, admin.id)
  await assert.rejects(api.call('members.remove', { id: admin.id }), code('member_remove_self'))
  await assert.rejects(api.call('members.remove', { id: 9999 }), code('member_not_found'))

  await api.call('members.remove', { id: ece.id })
  assert.deepEqual((await api.call('members.list', {})).map((m) => m.name), ['Anil', 'Can'])
  assert.equal((await api.call('entries.get', { id: entry })).author.name, 'Ece', 'the entry keeps its author')
  await assert.rejects(api.call('members.remove', { id: ece.id }), code('member_not_found'))
  api.lock()
  await assert.rejects(api.call('members.signIn', { id: ece.id, pin: '123456' }), code('member_not_found'))
  assert.equal((await db.query('SELECT count(*) AS n FROM member_pins WHERE member_id = ? AND deleted_at IS NULL', [ece.id]))[0].n, 0, 'the PIN goes with the member')
  const log = await db.query(`SELECT operation, summary, ok FROM activity_log WHERE operation = 'members.remove' AND ok = 1`)
  assert.deepEqual(log.map((r) => [r.summary, r.ok]), [[String(ece.id), 1]])
})

test('members.remove can take out a second admin, never the last one', async () => {
  const { api, db, admin, can } = await book()
  await api.call('members.update', { id: can.id, role: 'admin' })
  await api.call('members.remove', { id: can.id })
  assert.equal((await api.call('members.list', {})).length, 2)
  await assert.rejects(db.batch([{ sql: 'UPDATE actors SET deleted_at = 1, deleted_by = ? WHERE id = ?', params: [admin.id, admin.id] }]), /last_admin/)
})
