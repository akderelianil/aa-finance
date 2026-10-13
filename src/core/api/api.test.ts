// The API on in-memory SQLite: inputs, services, error codes, logs.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migrate } from '../migrate.ts'
import { openNodeDb, readMigrations } from '../test/node-db.ts'
import { createApi, type Api, type Input } from './index.ts'

type T = { api: Api; db: ReturnType<typeof openNodeDb>; acc: (key: string) => number }

async function fresh(): Promise<T> {
  const db = openNodeDb()
  await migrate(db, readMigrations())
  const api = createApi(db)
  await api.call('setup.run', { baseCurrency: 'TRY', language: 'en', userName: 'Test', recommended: true })
  return { api, db, acc: await keys(api) }
}

async function keys(api: Api) {
  const list = await api.call('accounts.list', {})
  return (key: string) => (list.find((a) => a.systemKey === key || a.name === key) ?? assert.fail(`no account ${key}`)).id
}

const code = (c: string) => (e: unknown) => {
  assert.equal((e as { code?: string }).code, c, String(e))
  return true
}

test('before setup only setup.run and currencies.list work; setup runs once', async () => {
  const db = openNodeDb()
  await migrate(db, readMigrations())
  const api = createApi(db)
  await assert.rejects(api.call('accounts.list', {}), code('not_setup'))
  assert.ok((await api.call('currencies.list', {})).some((c) => c.code === 'TRY' && c.minorUnit === 2))
  await assert.rejects(api.call('setup.run', { baseCurrency: 'XXX', language: 'en', userName: 'T', recommended: false }), code('currency_unknown'))
  await api.call('setup.run', { baseCurrency: 'TRY', language: 'tr', userName: 'T', recommended: false })
  await assert.rejects(api.call('setup.run', { baseCurrency: 'EUR', language: 'tr', userName: 'T', recommended: false }), code('already_setup'))
  const { me, ...rest } = await api.call('settings.get', {})
  assert.deepEqual(rest, { baseCurrency: 'TRY', language: 'tr', lockDate: null, activityLogDays: 365, userName: 'T', groupName: 'T', country: null })
  assert.deepEqual([me.role, me.color], ['admin', 'blue'])
  await api.call('settings.update', { language: 'en', lockDate: '2025-12-31' })
  assert.equal((await api.call('settings.get', {})).lockDate, '2025-12-31')
  await api.call('settings.update', { userName: ' Anıl ' })
  assert.equal((await api.call('settings.get', {})).userName, 'Anıl')
  await assert.rejects(api.call('settings.update', { userName: ' ' }), code('invalid_input'))
})

test('bad input fails with invalid_input and an unknown op with unknown_op', async () => {
  const { api } = await fresh()
  await assert.rejects(api.call('entries.post', { date: '2026-13-01', lines: [] }), code('invalid_input'))
  await assert.rejects(api.call('entries.post', { date: '2026-01-01', lines: [{ account: 'x', amount: 1.5 }, { account: 'y', amount: 1 }] } as never), code('invalid_input'))
  await assert.rejects(api.call('nope' as never, {} as never), code('unknown_op'))
})

test('accounts: create under a parent, rename, move, archive, delete', async () => {
  const { api, acc } = await fresh()
  const { id } = await api.call('accounts.create', { parent: acc('bank'), name: ' Akbank ' })
  let a = (await api.call('accounts.list', {})).find((x) => x.id === id)!
  assert.deepEqual([a.name, a.type, a.currency, a.parent, a.locked], ['Akbank', 'asset', 'TRY', acc('bank'), false])
  await assert.rejects(api.call('accounts.create', { parent: acc('bank'), name: 'Akbank' }), code('account_name_taken'))
  await assert.rejects(api.call('accounts.create', { parent: acc('bank'), name: 'X', currency: 'ZZZ' }), code('currency_unknown'))
  await assert.rejects(api.call('accounts.update', { id: acc('bank'), name: 'B' }), code('account_locked'))
  await assert.rejects(api.call('accounts.update', { id, parent: acc('expense') }), code('account_parent_type'))

  await api.call('accounts.update', { id, name: 'Akbank TL', parent: acc('cash') })
  await api.call('accounts.archive', { id, archived: true })
  a = (await api.call('accounts.list', {})).find((x) => x.id === id)!
  assert.deepEqual([a.name, a.parent, a.archived], ['Akbank TL', acc('cash'), true])
  await api.call('accounts.delete', { id })
  assert.ok(!(await api.call('accounts.list', {})).some((x) => x.id === id))
  await assert.rejects(api.call('accounts.delete', { id }), code('account_not_found'))
})

test('entries: post, number, balances, and database rules as codes', async () => {
  const { api, acc } = await fresh()
  const w = acc('Wallet')
  const g = acc('Groceries')
  const e = await api.call('entries.post', {
    date: '2026-03-01', description: 'Migros', lines: [{ account: g, amount: 50000 }, { account: w, amount: -50000 }],
  })
  assert.deepEqual([e.year, e.number], [2026, 1])
  assert.equal((await api.call('entries.post', { date: '2026-03-02', lines: [{ account: g, amount: 1 }, { account: w, amount: -1 }] })).number, 2)

  const bal = Object.fromEntries((await api.call('accounts.list', {})).map((a) => [a.id, a.balance]))
  assert.deepEqual([bal[w], bal[g]], [-50001, 50001])
  assert.equal((await api.call('accounts.list', { asOf: '2026-03-01' })).find((a) => a.id === w)!.balance, -50000)

  await assert.rejects(api.call('entries.post', { date: '2026-03-01', lines: [{ account: g, amount: 5 }, { account: w, amount: -4 }] }), code('entry_unbalanced'))
  await assert.rejects(api.call('entries.post', { date: '2026-03-01', lines: [{ account: acc('Food and Drink'), amount: 5 }, { account: w, amount: -5 }] }), code('account_placeholder'))
  await assert.rejects(api.call('entries.post', { date: '2026-03-01', lines: [{ account: 999999, amount: 5 }, { account: w, amount: -5 }] }), code('account_not_found'))
  await assert.rejects(api.call('entries.post', { date: '2026-03-01', lines: [{ account: g, amount: 5, rate: '2' }, { account: w, amount: -5 }] }), code('line_base_mismatch'))
  await api.call('settings.update', { lockDate: '2026-03-01' })
  await assert.rejects(api.call('entries.post', { date: '2026-03-01', lines: [{ account: g, amount: 5 }, { account: w, amount: -5 }] }), code('period_locked'))
  await assert.rejects(api.call('accounts.delete', { id: g }), code('account_has_lines'))
})

test('foreign currency: stored rate, given rate, given base, rounding to FX, missing rate', async () => {
  const { api, acc } = await fresh()
  const usd = (await api.call('accounts.create', { parent: acc('bank'), name: 'USD', currency: 'USD' })).id
  const g = acc('Groceries')
  const fxAcc = acc('fx_gain_loss')
  const post = (date: string, lines: Input<'entries.post'>['lines']) => api.call('entries.post', { date, lines })

  await assert.rejects(post('2026-03-01', [{ account: g, amount: 3410 }, { account: usd, amount: -100 }]), code('rate_missing'))
  await assert.rejects(api.call('fx.set', { currency: 'TRY', date: '2026-03-01', rate: '1' }), code('fx_base_currency'))
  await api.call('fx.set', { currency: 'USD', date: '2026-02-01', rate: '30' })
  await api.call('fx.set', { currency: 'USD', date: '2026-03-01', rate: '34.1' })
  assert.deepEqual(await api.call('fx.get', { currency: 'USD', date: '2026-03-15' }), { date: '2026-03-01', rate: '34.1' })
  assert.equal(await api.call('fx.get', { currency: 'USD', date: '2026-01-15' }), null)

  // Stored rate on or before the date.
  const a = await post('2026-03-02', [{ account: g, amount: 3410 }, { account: usd, amount: -100 }])
  let lines = (await api.call('entries.get', { id: a.id })).lines
  assert.deepEqual(lines.map((l) => [l.amount, l.baseAmount, l.rate]), [[3410, 3410, null], [-100, -3410, '34.1']])

  // Given base: the rate comes from it.
  const b = await post('2026-03-02', [{ account: g, amount: 3400 }, { account: usd, amount: -100, baseAmount: -3400 }])
  lines = (await api.call('entries.get', { id: b.id })).lines
  assert.deepEqual(lines[1].rate, '34')

  // Rounding: two converted lines at 33.335 → 0.5 each way; the difference (1 kuruş) goes to FX.
  const c = await post('2026-03-02', [
    { account: usd, amount: 1, rate: '33.335' }, { account: usd, amount: 1, rate: '33.335' }, { account: g, amount: -67 },
  ])
  lines = (await api.call('entries.get', { id: c.id })).lines
  assert.deepEqual(lines.map((l) => [l.account === fxAcc, l.baseAmount]), [[false, 33], [false, 33], [false, -67], [true, 1]])

  // More than rounding is an error.
  await assert.rejects(post('2026-03-02', [{ account: usd, amount: 1, rate: '33.335' }, { account: g, amount: -40 }]), code('entry_unbalanced'))
})

test('entries.update changes text in place, lines and date through draft; delete keeps the number', async () => {
  const { api, acc } = await fresh()
  const w = acc('Wallet')
  const g = acc('Groceries')
  const r = acc('Restaurants')
  const e = await api.call('entries.post', { date: '2026-03-01', lines: [{ account: g, amount: 500 }, { account: w, amount: -500 }] })
  await api.call('entries.update', { id: e.id, description: 'Migros', reference: 'F-1' })
  await api.call('entries.update', {
    id: e.id, date: '2026-03-05',
    lines: [{ account: g, amount: 300 }, { account: r, amount: 400, memo: 'dinner' }, { account: w, amount: -700 }],
  })
  const got = await api.call('entries.get', { id: e.id })
  assert.deepEqual([got.date, got.number, got.description, got.reference], ['2026-03-05', 1, 'Migros', 'F-1'])
  assert.deepEqual(got.lines.map((l) => [l.account, l.amount, l.memo]), [[g, 300, null], [r, 400, 'dinner'], [w, -700, null]])
  await api.call('entries.update', { id: e.id, date: '2026-03-06' })
  assert.equal((await api.call('entries.get', { id: e.id })).lines.length, 3)

  await api.call('entries.delete', { id: e.id })
  await assert.rejects(api.call('entries.get', { id: e.id }), code('entry_not_found'))
  const next = await api.call('entries.post', { date: '2026-03-01', lines: [{ account: g, amount: 1 }, { account: w, amount: -1 }] })
  assert.equal(next.number, 2)
  assert.equal((await api.call('accounts.list', {})).find((a) => a.id === g)!.balance, 1)
})

test('journal list pages newest first and searches; register runs a balance', async () => {
  const { api, acc } = await fresh()
  const w = acc('Wallet')
  const g = acc('Groceries')
  const s = acc('Salary')
  await api.call('entries.post', { date: '2026-01-01', description: 'Opening', lines: [{ account: w, amount: 10000 }, { account: s, amount: -10000 }] })
  for (let d = 1; d <= 5; d++)
    await api.call('entries.post', { date: `2026-02-0${d}`, description: `Market ${d}`, lines: [{ account: g, amount: d * 100 }, { account: w, amount: -d * 100 }] })
  await api.call('entries.post', { date: '2026-02-03', description: '50%_off', lines: [{ account: g, amount: 1 }, { account: acc('Restaurants'), amount: 1 }, { account: w, amount: -2 }] })

  const page = await api.call('entries.list', { page: 0, pageSize: 3 })
  assert.equal(page.total, 7)
  assert.deepEqual(page.rows.map((e) => e.description), ['Market 5', 'Market 4', '50%_off'])
  assert.equal(page.rows[0].lines.length, 2)
  assert.equal((await api.call('entries.list', { search: 'market' })).total, 5)
  assert.equal((await api.call('entries.list', { search: '%_' })).total, 1)
  assert.equal((await api.call('entries.list', { from: '2026-02-02', to: '2026-02-03' })).total, 3)

  const reg = await api.call('accounts.register', { id: w, from: '2026-02-01', page: 0, pageSize: 3 })
  assert.equal(reg.opening, 10000)
  assert.equal(reg.total, 6)
  assert.deepEqual(reg.rows.map((x) => [x.date, x.amount, x.balance, x.other !== null]), [
    ['2026-02-01', -100, 9900, true], ['2026-02-02', -200, 9700, true], ['2026-02-03', -300, 9400, true],
  ])
  assert.equal(reg.rows[0].other, g)
  const last = await api.call('accounts.register', { id: w, from: '2026-02-01', page: 1, pageSize: 3 })
  assert.deepEqual(last.rows.map((x) => [x.amount, x.balance, x.otherCount]), [[-2, 9398, 2], [-400, 8998, 1], [-500, 8498, 1]])
})

test('reports: trial balance totals match, balance sheet closes with earnings, income statement by period', async () => {
  const { api, acc } = await fresh()
  const w = acc('Wallet')
  await api.call('entries.post', { date: '2026-01-10', lines: [{ account: w, amount: 100000 }, { account: acc('Salary'), amount: -100000 }] })
  await api.call('entries.post', { date: '2026-02-10', lines: [{ account: acc('Groceries'), amount: 30000 }, { account: w, amount: -30000 }] })
  await api.call('entries.post', { date: '2026-02-11', lines: [{ account: w, amount: 5000 }, { account: acc('payables'), amount: -5000 }] })

  const tb = await api.call('reports.trialBalance', {})
  assert.equal(tb.debit, 105000)
  assert.equal(tb.credit, 105000)
  // Turnover per account: debit and credit sides add up to the same total.
  assert.equal(tb.rows.reduce((s, r) => s + r.debit, 0), tb.rows.reduce((s, r) => s + r.credit, 0))
  assert.ok(tb.rows.every((r) => r.debit - r.credit === r.balance))
  assert.equal((await api.call('reports.trialBalance', { asOf: '2026-01-31' })).debit, 100000)

  const bs = await api.call('reports.balanceSheet', {})
  assert.equal(bs.earnings, -70000)
  assert.equal(bs.rows.reduce((s, x) => s + x.balance, 0) + bs.earnings, 0)

  const is = await api.call('reports.incomeStatement', { from: '2026-02-01', to: '2026-02-28' })
  assert.deepEqual(is.rows.map((x) => [x.type, x.balance]), [['expense', 30000]])
  assert.equal(is.net, 30000)
})

test('activity_log records writes and failures; audit.forRow shows row history', async () => {
  const { api, acc } = await fresh()
  const { id } = await api.call('accounts.create', { parent: acc('bank'), name: 'A' })
  await api.call('accounts.update', { id, name: 'B' })
  await assert.rejects(api.call('accounts.update', { id: acc('bank'), name: 'X' }), code('account_locked'))
  await api.call('accounts.list', {})

  const log = await api.call('activity.list', { pageSize: 10 })
  assert.deepEqual(log.rows.map((x) => [x.operation, x.ok, x.errorCode]), [
    ['accounts.update', false, 'account_locked'], ['accounts.update', true, null], ['accounts.create', true, null], ['setup.run', true, null],
  ])
  assert.equal(log.rows[0].actor, 'Test')

  const hist = await api.call('audit.forRow', { table: 'accounts', id })
  assert.deepEqual(hist.map((h) => [h.op, h.new?.name]), [['insert', 'A'], ['update', 'B']])
})

test('members: setup adds them, admin manages, a member edits only own name and own entries', async () => {
  const db = openNodeDb()
  await migrate(db, readMigrations())
  const api = createApi(db)
  await assert.rejects(
    api.call('setup.run', { baseCurrency: 'TRY', language: 'tr', userName: 'Anıl', recommended: false, members: ['anıl'] }),
    code('member_name_taken'))
  await assert.rejects(
    api.call('setup.run', { baseCurrency: 'TRY', language: 'tr', userName: 'A', recommended: false, country: 'XX' }), code('invalid_input'))
  await api.call('setup.run', {
    baseCurrency: 'TRY', language: 'tr', userName: 'Anıl', recommended: false, country: 'TR', groupName: 'Akdereli Ailesi', members: ['Ece'],
  })
  const s = await api.call('settings.get', {})
  assert.deepEqual([s.groupName, s.country, s.me.role], ['Akdereli Ailesi', 'TR', 'admin'])
  const list = await api.call('members.list', {})
  assert.deepEqual(list.map((m) => [m.name, m.role, m.color, m.me]), [['Anıl', 'admin', 'blue', true], ['Ece', 'member', 'emerald', false]])
  const [admin, ece] = list

  const acc = await keys(api)
  const { id: adminEntry } = await api.call('entries.post', { date: '2026-01-02', lines: [{ account: acc('Cüzdan'), amount: 5 }, { account: acc('opening_balance'), amount: -5 }] })

  // As Ece (member).
  api.use(ece.id)
  assert.equal((await api.call('settings.get', {})).me.role, 'member')
  await assert.rejects(api.call('members.add', { name: 'Can' }), code('admin_only'))
  await assert.rejects(api.call('members.update', { id: admin.id, name: 'X' }), code('admin_only'))
  await assert.rejects(api.call('members.update', { id: ece.id, role: 'admin' }), code('admin_only'))
  await assert.rejects(api.call('settings.update', { groupName: 'X' }), code('admin_only'))
  for (const set of [{ language: 'en' }, { lockDate: '2026-01-01' }, { activityLogDays: 7 }, { country: 'DE' }] as const)
    await assert.rejects(api.call('settings.update', set), code('admin_only'))
  await api.call('settings.update', { userName: 'Ece' })
  assert.deepEqual((await api.call('entries.get', { id: adminEntry })).author.name, 'Anıl')
  await api.call('members.update', { id: ece.id, name: 'Ece A.', color: 'rose' })
  await assert.rejects(api.call('entries.delete', { id: adminEntry }), code('entry_not_owner'))
  await assert.rejects(api.call('entries.update', { id: adminEntry, description: 'x' }), code('entry_not_owner'))
  const { id: eceEntry } = await api.call('entries.post', { date: '2026-01-03', lines: [{ account: acc('Cüzdan'), amount: 7 }, { account: acc('opening_balance'), amount: -7 }] })
  await api.call('entries.update', { id: eceEntry, description: 'own' })
  // The trigger holds even without the API check.
  await assert.rejects(db.batch([{ sql: `UPDATE entries SET description = 'x', updated_by = (SELECT id FROM actors WHERE id = ?) WHERE id = ?`, params: [ece.id, adminEntry] }]), /entry_not_owner/)
  await assert.rejects(db.batch([{ sql: `UPDATE settings SET value = 'en', updated_by = (SELECT id FROM actors WHERE id = ?) WHERE key = 'language'`, params: [ece.id] }]), /admin_only/)
  await assert.rejects(db.batch([{ sql: `UPDATE actors SET name = 'x', updated_by = (SELECT id FROM actors WHERE id = ?) WHERE id = ?`, params: [ece.id, admin.id] }]), /admin_only/)

  // Back as the admin: edits Ece's entry, adds a member, keeps one admin.
  api.use(null)
  await api.call('entries.update', { id: eceEntry, description: 'by admin' })
  await assert.rejects(api.call('members.add', { name: 'ece a.' }), code('member_name_taken'))
  const { id: can } = await api.call('members.add', { name: 'Can' })
  assert.equal((await api.call('members.list', {})).find((m) => m.id === can)?.color, 'amber')
  await assert.rejects(api.call('members.update', { id: admin.id, role: 'member' }), code('last_admin'))
  await api.call('members.update', { id: can, role: 'admin' })
  await api.call('members.update', { id: admin.id, role: 'member' })
  api.use(999999)
  assert.equal((await api.call('settings.get', {})).me.id, can)
})

test('contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked', async () => {
  const { api, db, acc } = await fresh()
  const add = (kind: 'individual' | 'brand' | 'business', name: string, extra: object = {}) =>
    api.call('contacts.create', { kind, name, ...extra }).then((r) => r.id)
  const ali = await add('individual', 'Ali')
  const migros = await add('brand', 'Migros')
  const macro = await add('brand', 'Macrocenter')
  const firm = await add('business', 'Migros A.Ş.')
  const other = await add('business', 'Kipa A.Ş.', { partners: [macro] })

  // A business owns many brands; a brand belongs to many businesses.
  await api.call('contacts.update', { id: firm, partners: [migros, macro] })
  await api.call('contacts.update', { id: migros, partners: [firm, other] })
  const by = async () => new Map((await api.call('contacts.list', {})).map((c) => [c.id, c]))
  let m = await by()
  assert.deepEqual(m.get(firm)!.partners, [migros, macro])
  assert.deepEqual(m.get(migros)!.partners, [firm, other])
  assert.deepEqual(m.get(macro)!.partners, [firm, other].sort())
  assert.deepEqual(m.get(ali)!.partners, [])

  // Replacing the set unlinks the rest.
  await api.call('contacts.update', { id: firm, partners: [macro] })
  m = await by()
  assert.deepEqual(m.get(migros)!.partners, [other])
  assert.deepEqual(m.get(firm)!.partners, [macro])

  // Rules: kinds, names, accounts.
  await assert.rejects(api.call('contacts.update', { id: ali, partners: [firm] }), code('contact_link_kind'))
  await assert.rejects(api.call('contacts.update', { id: migros, partners: [macro] }), code('contact_link_kind'))
  await assert.rejects(api.call('contacts.create', { kind: 'brand', name: ' migros ' }), code('contact_name_taken'))
  await assert.rejects(api.call('contacts.update', { id: migros, incomeAccount: acc('bank') }), code('contact_account_type'))
  const food = (await api.call('accounts.list', {})).find((a) => a.type === 'expense' && !a.placeholder && !a.locked) ?? assert.fail('no expense account')
  await api.call('contacts.update', { id: migros, expenseAccount: food.id })
  assert.equal((await by()).get(migros)!.expenseAccount, food.id)
  await assert.rejects(db.batch([{ sql: `UPDATE contacts SET kind = 'business' WHERE id = ?`, params: [migros] }]), /contact_kind_fixed/)
  await assert.rejects(db.batch([{ sql: `INSERT INTO brand_businesses (created_by, updated_by, brand_id, business_id) VALUES (2, 2, ?, ?)`, params: [macro, firm] }]), /UNIQUE/)
  await assert.rejects(db.batch([{ sql: 'DELETE FROM contacts WHERE id = ?', params: [ali] }]), /no_delete/)

  // Removing a contact removes its links and frees the name.
  await api.call('contacts.delete', { id: firm })
  m = await by()
  assert.ok(!m.has(firm))
  assert.deepEqual(m.get(macro)!.partners, [other])
  const [{ n }] = await db.query('SELECT count(*) AS n FROM brand_businesses WHERE deleted_at IS NOT NULL AND deleted_by = 2')
  assert.ok((n as number) >= 1)
  await add('business', 'Migros A.Ş.')
  await assert.rejects(api.call('contacts.delete', { id: firm }), code('contact_not_found'))
  const hist = await api.call('audit.forRow', { table: 'contacts', id: firm })
  assert.deepEqual(hist.map((h) => h.op), ['insert', 'delete'])
})

test('entries.deleteAll: admin only, soft deletes every entry, keeps accounts, a locked period stops it', async () => {
  const { api, acc } = await fresh()
  const g = acc('Groceries')
  const post = (date: string) => api.call('entries.post', { date, lines: [{ account: g, amount: 5 }, { account: acc('opening_balance'), amount: -5 }] })
  await post('2026-01-02')
  await post('2026-01-03')
  await api.call('settings.update', { lockDate: '2026-01-02' })
  await assert.rejects(api.call('entries.deleteAll', {}), /period_locked/)
  await api.call('settings.update', { lockDate: null })
  assert.deepEqual(await api.call('entries.deleteAll', {}), { count: 2 })
  assert.deepEqual(await api.call('entries.deleteAll', {}), { count: 0 })
  assert.equal((await api.call('accounts.list', {})).find((a) => a.id === g)!.balance, 0)
})

test('contact on a debt line: balances per contact, a used contact cannot be removed, the line keeps it on edit', async () => {
  const { api, db, acc } = await fresh()
  const ali = (await api.call('contacts.create', { kind: 'individual', name: 'Ali' })).id
  const veli = (await api.call('contacts.create', { kind: 'individual', name: 'Veli' })).id
  const post = (lines: { account: number; amount: number; contact?: number }[]) => api.call('entries.post', { date: '2026-03-01', lines })

  await post([{ account: acc('receivables'), amount: 200000, contact: ali }, { account: acc('Wallet'), amount: -200000 }])
  await post([{ account: acc('Wallet'), amount: 50000 }, { account: acc('receivables'), amount: -50000, contact: ali }])
  const borrow = await post([{ account: acc('Wallet'), amount: 70000 }, { account: acc('payables'), amount: -70000, contact: veli }])
  assert.deepEqual(
    (await api.call('contacts.balances', {})).sort((a, b) => a.contact - b.contact),
    [{ contact: ali, currency: 'TRY', kind: 'receivable', amount: 150000 }, { contact: veli, currency: 'TRY', kind: 'payable', amount: 70000 }],
  )

  // The line keeps its contact when the entry is read and when only the text changes.
  const e = await api.call('entries.get', { id: borrow.id })
  assert.deepEqual(e.lines.map((l) => l.contact), [null, veli])
  await assert.rejects(post([{ account: acc('Wallet'), amount: 1 }, { account: acc('payables'), amount: -1, contact: 999 }]), code('contact_not_found'))
  await assert.rejects(api.call('contacts.delete', { id: veli }), code('contact_has_lines'))

  // Deleting the entry frees the contact and its balance.
  await api.call('entries.delete', { id: borrow.id })
  assert.equal((await api.call('contacts.balances', {})).length, 1)
  await api.call('contacts.delete', { id: veli })
  await assert.rejects(post([{ account: acc('Wallet'), amount: 1 }, { account: acc('payables'), amount: -1, contact: veli }]), code('contact_not_found'))
  assert.equal(((await db.query('SELECT count(*) AS n FROM lines WHERE contact_id IS NOT NULL'))[0].n as number) > 0, true)
})

test('account owner: Aile, Kişi and Ortak filter reports and the journal', async () => {
  const { api, acc } = await fresh()
  const me = (await api.call('members.list', {}))[0].id
  const { id: mine } = await api.call('accounts.create', { parent: acc('cash'), name: 'Kişisel', owner: me })
  const { id: child } = await api.call('accounts.create', { parent: mine, name: 'Alt' })
  const list = await api.call('accounts.list', {})
  assert.equal(list.find((a) => a.id === mine)!.owner, me)
  assert.equal(list.find((a) => a.id === child)!.owner, me, 'a child takes the parent owner')
  assert.equal(list.find((a) => a.id === acc('bank'))!.owner, null)
  await assert.rejects(api.call('accounts.create', { parent: acc('bank'), name: 'Y', owner: 999 }), code('member_not_found'))

  const income = (await api.call('accounts.create', { parent: acc('income'), name: 'Maaş' })).id
  const shared = (await api.call('accounts.create', { parent: acc('bank'), name: 'Ortak Banka' })).id
  await api.call('entries.post', { date: '2026-02-01', description: 'mine', lines: [{ account: child, amount: 1000 }, { account: income, amount: -1000 }] })
  await api.call('entries.post', { date: '2026-02-02', description: 'shared', lines: [{ account: shared, amount: 500 }, { account: income, amount: -500 }] })

  assert.equal((await api.call('reports.trialBalance', {})).rows.length, 3)
  assert.deepEqual((await api.call('reports.trialBalance', { owner: me })).rows.map((r) => r.account), [child])
  assert.deepEqual((await api.call('reports.trialBalance', { owner: 'shared' })).rows.map((r) => r.account).sort(), [shared, income].sort())
  assert.equal((await api.call('reports.balanceSheet', { owner: me })).earnings, 0)
  assert.equal((await api.call('reports.incomeStatement', { from: '2026-02-01', to: '2026-02-28', owner: me })).net, 0)

  assert.equal((await api.call('entries.list', {})).total, 2)
  const own = await api.call('entries.list', { owner: me, pageSize: 10 })
  assert.deepEqual([own.total, own.rows.map((e) => e.description)], [1, ['mine']])
  // An entry shows under every owner it touches: the Maaş line is shared.
  assert.equal((await api.call('entries.list', { owner: 'shared' })).total, 2)

  await api.call('accounts.update', { id: child, owner: null })
  assert.equal((await api.call('entries.list', { owner: me })).total, 0)
})

test('line member: a line belongs to its member, else to its account owner', async () => {
  const { api, acc } = await fresh()
  await api.call('members.add', { name: 'Ayşe' })
  const [a, b] = await api.call('members.list', {})
  const bank = (await api.call('accounts.create', { parent: acc('bank'), name: 'Ortak Banka' })).id
  const wallet = (await api.call('accounts.create', { parent: acc('cash'), name: 'A Cüzdan', owner: a.id })).id
  const income = (await api.call('accounts.create', { parent: acc('income'), name: 'Maaş' })).id
  // b's salary lands on the shared account; a's wallet money has no tag.
  await api.call('entries.post', { date: '2026-03-01', lines: [{ account: bank, amount: 700, member: b.id }, { account: income, amount: -700, member: b.id }] })
  await api.call('entries.post', { date: '2026-03-02', lines: [{ account: wallet, amount: 300 }, { account: income, amount: -300, member: a.id }] })
  await assert.rejects(api.call('entries.post', { date: '2026-03-03', lines: [{ account: bank, amount: 1, member: 999 }, { account: income, amount: -1 }] }), code('member_not_found'))

  const bal = async (owner?: number | 'shared') =>
    Object.fromEntries((await api.call('accounts.list', { owner })).filter((x) => [bank, wallet].includes(x.id)).map((x) => [x.name, x.baseBalance]))
  assert.deepEqual(await bal(), { 'Ortak Banka': 700, 'A Cüzdan': 300 })
  assert.deepEqual(await bal(b.id), { 'Ortak Banka': 700, 'A Cüzdan': 0 })
  assert.deepEqual(await bal(a.id), { 'Ortak Banka': 0, 'A Cüzdan': 300 })
  assert.deepEqual(await bal('shared'), { 'Ortak Banka': 0, 'A Cüzdan': 0 })
  assert.equal((await api.call('reports.incomeStatement', { from: '2026-03-01', to: '2026-03-31', owner: b.id })).net, -700)
  assert.equal((await api.call('entries.list', { owner: b.id })).total, 1)
  assert.equal((await api.call('entries.get', { id: 1 })).lines[0].member, b.id)
})
