// Grants: the admin decides which members may change shared data (accounts, rates, contacts).
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
  const accounts = await api.call('accounts.list', {})
  const acc = (key: string) => accounts.find((a) => a.systemKey === key || a.name === key)!.id
  return { api, db, admin, ece, can, acc }
}

const none = { accounts: false, rates: false, contacts: false }

test('a new member has no grants; the admin has every grant', async () => {
  const { api, admin, ece } = await book()
  const list = await api.call('members.list', {})
  assert.deepEqual(list.find((m) => m.id === admin.id)!.grants, { accounts: true, rates: true, contacts: true })
  assert.deepEqual(list.find((m) => m.id === ece.id)!.grants, none)
  await api.call('members.add', { name: 'Deniz', grants: { rates: true } })
  assert.deepEqual((await api.call('members.list', {})).find((m) => m.name === 'Deniz')!.grants, { ...none, rates: true })
})

test('without a grant a member cannot change accounts, rates or contacts; reading stays open', async () => {
  const { api, ece, acc } = await book()
  const contact = (await api.call('contacts.create', { kind: 'individual', name: 'Ali' })).id
  const group = acc('Groceries')
  await as(api, ece.id)
  await assert.rejects(api.call('accounts.create', { parent: acc('bank'), name: 'X', currency: 'TRY' }), code('permission_denied'))
  await assert.rejects(api.call('accounts.update', { id: group, name: 'Food' }), code('permission_denied'))
  await assert.rejects(api.call('accounts.archive', { id: group, archived: true }), code('permission_denied'))
  await assert.rejects(api.call('accounts.delete', { id: group }), code('permission_denied'))
  await assert.rejects(api.call('fx.set', { currency: 'USD', date: '2026-03-01', rate: '34' }), code('permission_denied'))
  await assert.rejects(api.call('contacts.create', { kind: 'individual', name: 'Veli' }), code('permission_denied'))
  await assert.rejects(api.call('contacts.update', { id: contact, name: 'Ali B.' }), code('permission_denied'))
  await assert.rejects(api.call('contacts.delete', { id: contact }), code('permission_denied'))
  assert.ok((await api.call('accounts.list', {})).length > 0)
  assert.equal((await api.call('contacts.list', {})).length, 1)
  // Posting entries needs no grant.
  await api.call('entries.post', { date: '2026-03-01', lines: [{ account: acc('Wallet'), amount: 5 }, { account: acc('opening_balance'), amount: -5 }] })
})

test('each grant opens only its own area, and only the admin can give or take it', async () => {
  const { api, db, admin, ece, can, acc } = await book()
  await api.call('members.update', { id: ece.id, grants: { accounts: true } })
  await as(api, ece.id)
  const id = (await api.call('accounts.create', { parent: acc('bank'), name: 'Savings', currency: 'TRY' })).id
  await api.call('accounts.update', { id, name: 'Savings 2' })
  await api.call('accounts.archive', { id, archived: true })
  await assert.rejects(api.call('fx.set', { currency: 'USD', date: '2026-03-01', rate: '34' }), code('permission_denied'))
  await assert.rejects(api.call('contacts.create', { kind: 'individual', name: 'Veli' }), code('permission_denied'))
  await assert.rejects(api.call('members.update', { id: ece.id, grants: { rates: true } }), code('admin_only'))
  await assert.rejects(api.call('members.update', { id: can.id, grants: { rates: true } }), code('admin_only'))

  await as(api, admin.id)
  await api.call('members.update', { id: ece.id, grants: { accounts: false, rates: true, contacts: true } })
  await as(api, ece.id)
  await assert.rejects(api.call('accounts.create', { parent: acc('bank'), name: 'Again', currency: 'TRY' }), code('permission_denied'))
  await api.call('fx.set', { currency: 'USD', date: '2026-03-01', rate: '34' })
  const ali = (await api.call('contacts.create', { kind: 'individual', name: 'Ali' })).id
  await api.call('contacts.delete', { id: ali })

  // The trigger holds without the API check.
  await assert.rejects(
    db.batch([{ sql: `INSERT INTO accounts (parent_id, name, type, currency_id, created_by, updated_by)
      SELECT parent_id, 'Direct', type, currency_id, ?, ? FROM accounts WHERE id = ?`, params: [ece.id, ece.id, acc('bank')] }]),
    /permission_denied/)
  await assert.rejects(db.batch([{ sql: 'UPDATE actors SET can_manage_accounts = 1, updated_by = ? WHERE id = ?', params: [ece.id, ece.id] }]), /admin_only/)
})

test('a grant change is written to audit_log', async () => {
  const { api, db, ece } = await book()
  await api.call('members.update', { id: ece.id, grants: { contacts: true } })
  const rows = await db.query(`SELECT old, new FROM audit_log WHERE table_name = 'actors' AND row_id = ? ORDER BY id DESC LIMIT 1`, [ece.id])
  assert.equal(JSON.parse(rows[0].old as string).can_manage_contacts, 0)
  assert.equal(JSON.parse(rows[0].new as string).can_manage_contacts, 1)
})
