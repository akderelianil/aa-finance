// The API on in-memory SQLite: inputs, services, error codes, logs.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migrate } from '../migrate.ts'
import { openNodeDb, readMigrations } from '../test/node-db.ts'
import { createApi, type Api, type Input } from './index.ts'

type T = { api: Api; db: ReturnType<typeof openNodeDb>; acc: (key: string) => string }

async function fresh(): Promise<T> {
  const db = openNodeDb()
  await migrate(db, readMigrations())
  const api = createApi(db)
  await api.call('setup.run', { baseCurrency: 'TRY', language: 'en', userName: 'Test', recommended: true })
  return { api, db, acc: await keys(api) }
}

async function keys(api: Api) {
  const list = await api.call('accounts.list', {})
  return (key: string) => (list.find((a) => a.systemKey === key || a.name === key) ?? assert.fail(`no account ${key}`)).uid
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
  assert.deepEqual(await api.call('settings.get', {}), { baseCurrency: 'TRY', language: 'tr', lockDate: null, activityLogDays: 365 })
  await api.call('settings.update', { language: 'en', lockDate: '2025-12-31' })
  assert.equal((await api.call('settings.get', {})).lockDate, '2025-12-31')
})

test('bad input fails with invalid_input and an unknown op with unknown_op', async () => {
  const { api } = await fresh()
  await assert.rejects(api.call('entries.post', { date: '2026-13-01', lines: [] }), code('invalid_input'))
  await assert.rejects(api.call('entries.post', { date: '2026-01-01', lines: [{ account: 'x', amount: 1.5 }, { account: 'y', amount: 1 }] } as never), code('invalid_input'))
  await assert.rejects(api.call('nope' as never, {} as never), code('unknown_op'))
})

test('accounts: create under a parent, rename, move, archive, delete', async () => {
  const { api, acc } = await fresh()
  const { uid } = await api.call('accounts.create', { parent: acc('bank'), name: ' Akbank ' })
  let a = (await api.call('accounts.list', {})).find((x) => x.uid === uid)!
  assert.deepEqual([a.name, a.type, a.currency, a.parent, a.locked], ['Akbank', 'asset', 'TRY', acc('bank'), false])
  await assert.rejects(api.call('accounts.create', { parent: acc('bank'), name: 'Akbank' }), code('account_name_taken'))
  await assert.rejects(api.call('accounts.create', { parent: acc('bank'), name: 'X', currency: 'ZZZ' }), code('currency_unknown'))
  await assert.rejects(api.call('accounts.update', { uid: acc('bank'), name: 'B' }), code('account_locked'))
  await assert.rejects(api.call('accounts.update', { uid, parent: acc('expense') }), code('account_parent_type'))

  await api.call('accounts.update', { uid, name: 'Akbank TL', parent: acc('cash') })
  await api.call('accounts.archive', { uid, archived: true })
  a = (await api.call('accounts.list', {})).find((x) => x.uid === uid)!
  assert.deepEqual([a.name, a.parent, a.archived], ['Akbank TL', acc('cash'), true])
  await api.call('accounts.delete', { uid })
  assert.ok(!(await api.call('accounts.list', {})).some((x) => x.uid === uid))
  await assert.rejects(api.call('accounts.delete', { uid }), code('account_not_found'))
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

  const bal = Object.fromEntries((await api.call('accounts.list', {})).map((a) => [a.uid, a.balance]))
  assert.deepEqual([bal[w], bal[g]], [-50001, 50001])
  assert.equal((await api.call('accounts.list', { asOf: '2026-03-01' })).find((a) => a.uid === w)!.balance, -50000)

  await assert.rejects(api.call('entries.post', { date: '2026-03-01', lines: [{ account: g, amount: 5 }, { account: w, amount: -4 }] }), code('entry_unbalanced'))
  await assert.rejects(api.call('entries.post', { date: '2026-03-01', lines: [{ account: acc('Food and Drink'), amount: 5 }, { account: w, amount: -5 }] }), code('account_placeholder'))
  await assert.rejects(api.call('entries.post', { date: '2026-03-01', lines: [{ account: '00000000-0000-7000-8000-00000000abcd', amount: 5 }, { account: w, amount: -5 }] }), code('account_not_found'))
  await assert.rejects(api.call('entries.post', { date: '2026-03-01', lines: [{ account: g, amount: 5, rate: '2' }, { account: w, amount: -5 }] }), code('line_base_mismatch'))
  await api.call('settings.update', { lockDate: '2026-03-01' })
  await assert.rejects(api.call('entries.post', { date: '2026-03-01', lines: [{ account: g, amount: 5 }, { account: w, amount: -5 }] }), code('period_locked'))
  await assert.rejects(api.call('accounts.delete', { uid: g }), code('account_has_lines'))
})

test('foreign currency: stored rate, given rate, given base, rounding to FX, missing rate', async () => {
  const { api, acc } = await fresh()
  const usd = (await api.call('accounts.create', { parent: acc('bank'), name: 'USD', currency: 'USD' })).uid
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
  let lines = (await api.call('entries.get', { uid: a.uid })).lines
  assert.deepEqual(lines.map((l) => [l.amount, l.baseAmount, l.rate]), [[3410, 3410, null], [-100, -3410, '34.1']])

  // Given base: the rate comes from it.
  const b = await post('2026-03-02', [{ account: g, amount: 3400 }, { account: usd, amount: -100, baseAmount: -3400 }])
  lines = (await api.call('entries.get', { uid: b.uid })).lines
  assert.deepEqual(lines[1].rate, '34')

  // Rounding: two converted lines at 33.335 → 0.5 each way; the difference (1 kuruş) goes to FX.
  const c = await post('2026-03-02', [
    { account: usd, amount: 1, rate: '33.335' }, { account: usd, amount: 1, rate: '33.335' }, { account: g, amount: -67 },
  ])
  lines = (await api.call('entries.get', { uid: c.uid })).lines
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
  await api.call('entries.update', { uid: e.uid, description: 'Migros', reference: 'F-1' })
  await api.call('entries.update', {
    uid: e.uid, date: '2026-03-05',
    lines: [{ account: g, amount: 300 }, { account: r, amount: 400, memo: 'dinner' }, { account: w, amount: -700 }],
  })
  const got = await api.call('entries.get', { uid: e.uid })
  assert.deepEqual([got.date, got.number, got.description, got.reference], ['2026-03-05', 1, 'Migros', 'F-1'])
  assert.deepEqual(got.lines.map((l) => [l.account, l.amount, l.memo]), [[g, 300, null], [r, 400, 'dinner'], [w, -700, null]])
  await api.call('entries.update', { uid: e.uid, date: '2026-03-06' })
  assert.equal((await api.call('entries.get', { uid: e.uid })).lines.length, 3)

  await api.call('entries.delete', { uid: e.uid })
  await assert.rejects(api.call('entries.get', { uid: e.uid }), code('entry_not_found'))
  const next = await api.call('entries.post', { date: '2026-03-01', lines: [{ account: g, amount: 1 }, { account: w, amount: -1 }] })
  assert.equal(next.number, 2)
  assert.equal((await api.call('accounts.list', {})).find((a) => a.uid === g)!.balance, 1)
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

  const reg = await api.call('accounts.register', { uid: w, from: '2026-02-01', page: 0, pageSize: 3 })
  assert.equal(reg.opening, 10000)
  assert.equal(reg.total, 6)
  assert.deepEqual(reg.rows.map((x) => [x.date, x.amount, x.balance, x.other !== null]), [
    ['2026-02-01', -100, 9900, true], ['2026-02-02', -200, 9700, true], ['2026-02-03', -300, 9400, true],
  ])
  assert.equal(reg.rows[0].other, g)
  const last = await api.call('accounts.register', { uid: w, from: '2026-02-01', page: 1, pageSize: 3 })
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
  const { uid } = await api.call('accounts.create', { parent: acc('bank'), name: 'A' })
  await api.call('accounts.update', { uid, name: 'B' })
  await assert.rejects(api.call('accounts.update', { uid: acc('bank'), name: 'X' }), code('account_locked'))
  await api.call('accounts.list', {})

  const log = await api.call('activity.list', { pageSize: 10 })
  assert.deepEqual(log.rows.map((x) => [x.operation, x.ok, x.errorCode]), [
    ['accounts.update', false, 'account_locked'], ['accounts.update', true, null], ['accounts.create', true, null], ['setup.run', true, null],
  ])
  assert.equal(log.rows[0].actor, 'Test')

  const hist = await api.call('audit.forRow', { table: 'accounts', uid })
  assert.deepEqual(hist.map((h) => [h.op, h.new?.name]), [['insert', 'A'], ['update', 'B']])
})
