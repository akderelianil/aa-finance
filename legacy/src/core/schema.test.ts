// Database rules (0001_schema.sql) on in-memory SQLite.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coreAccounts, recommendedAccounts } from './chart.ts'
import type { Db, Statement, Value } from './db.ts'
import { migrate, pruneActivityLog } from './migrate.ts'
import { setup } from './setup.ts'
import { openNodeDb, readMigrations } from './test/node-db.ts'

type Ctx = { db: Db; actor: number; acc: (key: string) => number }

async function fresh(recommended = false): Promise<Ctx> {
  const db = openNodeDb()
  await migrate(db, readMigrations())
  const actor = await setup(db, { baseCurrency: 'TRY', language: 'en', userName: 'Test', recommended })
  const rows = await db.query('SELECT id, coalesce(system_key, name) AS k FROM accounts')
  const ids = new Map(rows.map((r) => [r.k, r.id as number]))
  const acc = (key: string) => ids.get(key) ?? assert.fail(`no account ${key}`)
  return { db, actor, acc }
}

function insert(ctx: Ctx, table: string, row: Record<string, Value>): Statement {
  const r = { created_by: ctx.actor, updated_by: ctx.actor, ...row }
  const cols = Object.keys(r)
  return { sql: `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, params: Object.values(r) }
}

function update(ctx: Ctx, table: string, id: number, set: Record<string, Value>): Statement {
  const r = { ...set, ...(set.deleted_at != null && { deleted_by: ctx.actor }), updated_by: ctx.actor, updated_at: Date.now() }
  const cols = Object.keys(r)
  return { sql: `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, params: [...Object.values(r), id] }
}

async function account(ctx: Ctx, parent: string, name: string, currency = 'TRY'): Promise<number> {
  const [{ id: currency_id }] = await ctx.db.query('SELECT id FROM currencies WHERE code = ?', [currency])
  const [{ type }] = await ctx.db.query('SELECT type FROM accounts WHERE id = ?', [ctx.acc(parent)])
  await ctx.db.batch([insert(ctx, 'accounts', { parent_id: ctx.acc(parent), name, type, currency_id })])
  const [{ id }] = await ctx.db.query('SELECT max(id) AS id FROM accounts')
  return id as number
}

type Line = [account: number, amount: number, base?: number, rate?: string]

/** Writes a draft entry, then its lines and (by default) the post in a second batch. */
async function entry(ctx: Ctx, date: string, lines: Line[], post = true): Promise<number> {
  await ctx.db.batch([insert(ctx, 'entries', { entry_date: date })])
  const [{ id }] = await ctx.db.query('SELECT max(id) AS id FROM entries')
  await ctx.db.batch([
    ...lines.map(([account_id, amount, base, rate], i) =>
      insert(ctx, 'lines', { entry_id: id, account_id, entry_date: date, amount, base_amount: base ?? amount, rate: rate ?? null, position: i }),
    ),
    ...(post ? [update(ctx, 'entries', id as number, { state: 'posted' })] : []),
  ])
  return id as number
}

async function one(db: Db, sql: string, params: Value[] = []) {
  const [row] = await db.query(sql, params)
  return row
}

test('setup writes the core chart, optional recommended accounts, and runs once', async () => {
  const ctx = await fresh()
  const { n } = await one(ctx.db, 'SELECT count(*) AS n FROM accounts WHERE locked = 1')
  assert.equal(n, coreAccounts.length)
  assert.equal((await one(ctx.db, 'SELECT count(*) AS n FROM accounts WHERE parent_id IS NULL')).n, 5)
  assert.equal((await one(ctx.db, "SELECT count(*) AS n FROM accounts WHERE name = 'Wallet'")).n, 1)
  await assert.rejects(setup(ctx.db, { baseCurrency: 'EUR', language: 'en', userName: 'Again', recommended: false }), /UNIQUE/)

  const full = await fresh(true)
  const { m } = await one(full.db, 'SELECT count(*) AS m FROM accounts WHERE locked = 0')
  assert.equal(m, recommendedAccounts.length + 1)
  assert.equal((await one(full.db, "SELECT type FROM accounts WHERE name = 'Restaurants'")).type, 'expense')
})

test('setup rejects an unknown base currency', async () => {
  const db = openNodeDb()
  await migrate(db, readMigrations())
  await assert.rejects(setup(db, { baseCurrency: 'XXX', language: 'tr', userName: 'T', recommended: false }), /currency_unknown/)
})

test('no table allows DELETE', async () => {
  const ctx = await fresh()
  await ctx.db.batch([insert(ctx, 'fx_rates', { date: '2026-01-01', currency_id: 1, rate: '1.5' })])
  for (const t of ['currencies', 'actors', 'settings', 'fx_rates', 'accounts', 'entries', 'lines', 'audit_log', 'activity_log']) {
    await ctx.db.batch([{ sql: `INSERT INTO activity_log (actor_id, operation, ok) VALUES (${ctx.actor}, 'x', 1)` }])
    await entry(ctx, '2026-01-01', [[ctx.acc('Wallet'), 100], [ctx.acc('bank_fee'), -100]])
    await assert.rejects(ctx.db.batch([{ sql: `DELETE FROM ${t}` }]), /no_delete|log_immutable/, t)
  }
})

test('posting needs two balanced lines and assigns numbers per year', async () => {
  const ctx = await fresh()
  const w = ctx.acc('Wallet')
  const fee = ctx.acc('bank_fee')
  await assert.rejects(entry(ctx, '2026-03-01', [[w, -500], [fee, 400]]), /entry_unbalanced/)
  await assert.rejects(entry(ctx, '2026-03-01', [[w, -500]]), /entry_too_few_lines/)
  const a = await entry(ctx, '2026-03-01', [[w, -500], [fee, 500]])
  const b = await entry(ctx, '2026-03-02', [[w, -100], [fee, 60], [fee, 40]])
  const c = await entry(ctx, '2027-01-05', [[w, -1], [fee, 1]])
  const nums = await ctx.db.query('SELECT id, year, number FROM entries WHERE id IN (?, ?, ?) ORDER BY id', [a, b, c])
  assert.deepEqual(nums.map((r) => [r.year, r.number]), [[2026, 1], [2026, 2], [2027, 1]])
  await assert.rejects(ctx.db.batch([insert(ctx, 'entries', { entry_date: '2026-01-01', state: 'posted' })]), /entry_insert_draft/)
  await assert.rejects(ctx.db.batch([update(ctx, 'entries', a, { number: 9 })]), /entry_number_fixed/)
})

test('lines of a posted entry change only through draft, and the number stays', async () => {
  const ctx = await fresh()
  const w = ctx.acc('Wallet')
  const fee = ctx.acc('bank_fee')
  const id = await entry(ctx, '2026-03-01', [[w, -500], [fee, 500]])
  const lines = await ctx.db.query('SELECT id FROM lines WHERE entry_id = ? ORDER BY position', [id])
  const [l1, l2] = lines.map((r) => r.id as number)
  await assert.rejects(ctx.db.batch([update(ctx, 'lines', l1, { amount: -700, base_amount: -700 })]), /entry_not_draft/)
  await assert.rejects(ctx.db.batch([insert(ctx, 'lines', { entry_id: id, account_id: w, entry_date: '2026-03-01', amount: 1, base_amount: 1 })]), /entry_not_draft/)
  await assert.rejects(ctx.db.batch([update(ctx, 'entries', id, { entry_date: '2026-03-05' })]), /entry_posted/)

  // Edit: draft, change lines and date, post again, in one batch.
  await ctx.db.batch([
    update(ctx, 'entries', id, { state: 'draft' }),
    update(ctx, 'entries', id, { entry_date: '2026-03-05' }),
    update(ctx, 'lines', l1, { amount: -700, base_amount: -700 }),
    update(ctx, 'lines', l2, { deleted_at: Date.now() }),
    insert(ctx, 'lines', { entry_id: id, account_id: fee, entry_date: '2026-03-05', amount: 700, base_amount: 700 }),
    update(ctx, 'entries', id, { state: 'posted' }),
  ])
  const e = await one(ctx.db, 'SELECT number, state FROM entries WHERE id = ?', [id])
  assert.deepEqual({ ...e }, { number: 1, state: 'posted' })
  const live = await ctx.db.query('SELECT entry_date, amount FROM lines WHERE entry_id = ? AND deleted_at IS NULL ORDER BY amount', [id])
  assert.deepEqual(live.map((r) => [r.entry_date, r.amount]), [['2026-03-05', -700], ['2026-03-05', 700]])
})

test('a soft-deleted entry takes its lines with it, is final, and keeps its number', async () => {
  const ctx = await fresh()
  const w = ctx.acc('Wallet')
  const fee = ctx.acc('bank_fee')
  const id = await entry(ctx, '2026-03-01', [[w, -500], [fee, 500]])
  await ctx.db.batch([update(ctx, 'entries', id, { deleted_at: Date.now() })])
  assert.equal((await one(ctx.db, 'SELECT count(*) AS n FROM lines WHERE entry_id = ? AND deleted_at IS NULL', [id])).n, 0)
  await assert.rejects(ctx.db.batch([update(ctx, 'entries', id, { deleted_at: null })]), /row_deleted/)
  const next = await entry(ctx, '2026-03-02', [[w, -1], [fee, 1]])
  assert.equal((await one(ctx.db, 'SELECT number FROM entries WHERE id = ?', [next])).number, 2)
})

test('lines need a usable account', async () => {
  const ctx = await fresh()
  const fee = ctx.acc('bank_fee')
  await assert.rejects(entry(ctx, '2026-03-01', [[ctx.acc('cash'), -5], [fee, 5]]), /account_placeholder/)
  const old = await account(ctx, 'cash', 'Old Wallet')
  await ctx.db.batch([update(ctx, 'accounts', old, { archived_at: Date.now() })])
  await assert.rejects(entry(ctx, '2026-03-01', [[old, -5], [fee, 5]]), /account_archived/)
  const gone = await account(ctx, 'cash', 'Gone')
  await ctx.db.batch([update(ctx, 'accounts', gone, { deleted_at: Date.now() })])
  await assert.rejects(entry(ctx, '2026-03-01', [[gone, -5], [fee, 5]]), /account_deleted/)
})

test('amounts: integers only, nonzero, same sign; base and rate follow the account currency', async () => {
  const ctx = await fresh()
  const w = ctx.acc('Wallet')
  const fee = ctx.acc('bank_fee')
  const usd = await account(ctx, 'bank', 'USD Account', 'USD')
  await assert.rejects(entry(ctx, '2026-03-01', [[w, -1.5], [fee, 1.5]]), /cannot store REAL/)
  await assert.rejects(entry(ctx, '2026-03-01', [[w, 0], [fee, 0]]), /CHECK/)
  await assert.rejects(entry(ctx, '2026-03-01', [[usd, 100, -4100, '41'], [w, 4100]]), /CHECK/)
  await assert.rejects(entry(ctx, '2026-03-01', [[w, -5, -6], [fee, 6]]), /line_base_mismatch/)
  await assert.rejects(entry(ctx, '2026-03-01', [[w, -5, -5, '1'], [fee, 5]]), /line_base_mismatch/)
  await assert.rejects(entry(ctx, '2026-03-01', [[usd, 1000, 41000], [w, -41000]]), /line_rate_required/)
  await assert.rejects(entry(ctx, '2026-03-01', [[usd, 1000, 41000, '4,1'], [w, -41000]]), /CHECK/)
  await entry(ctx, '2026-03-01', [[usd, 1000, 41000, '41.00'], [w, -41000]])
  await assert.rejects(ctx.db.batch([update(ctx, 'accounts', usd, { currency_id: 1 })]), /account_has_lines/)
})

test('account tree rules', async () => {
  const ctx = await fresh()
  const [{ id: try_ }] = await ctx.db.query("SELECT id FROM currencies WHERE code = 'TRY'")
  await assert.rejects(
    ctx.db.batch([insert(ctx, 'accounts', { parent_id: ctx.acc('cash'), name: 'Wrong', type: 'expense', currency_id: try_ })]),
    /account_parent_type/,
  )
  await assert.rejects(
    ctx.db.batch([insert(ctx, 'accounts', { name: 'Root', type: 'asset', currency_id: try_ })]),
    /CHECK/,
  )
  await assert.rejects(
    ctx.db.batch([insert(ctx, 'accounts', { parent_id: ctx.acc('cash'), name: 'Wallet', type: 'asset', currency_id: try_ })]),
    /UNIQUE/,
  )
  await assert.rejects(ctx.db.batch([update(ctx, 'accounts', ctx.acc('bank_fee'), { name: 'Fees' })]), /account_locked/)
  await assert.rejects(ctx.db.batch([update(ctx, 'accounts', ctx.acc('Wallet'), { locked: 1 })]), /account_field_fixed/)
  await assert.rejects(ctx.db.batch([update(ctx, 'accounts', ctx.acc('Wallet'), { parent_id: ctx.acc('loans') })]), /account_parent_type/)

  const a = await account(ctx, 'cash', 'A')
  const b = await account(ctx, 'cash', 'B')
  await ctx.db.batch([update(ctx, 'accounts', b, { parent_id: a })])
  await assert.rejects(ctx.db.batch([update(ctx, 'accounts', a, { parent_id: b })]), /account_parent_cycle/)
  await assert.rejects(ctx.db.batch([update(ctx, 'accounts', a, { deleted_at: Date.now() })]), /account_has_children/)

  await entry(ctx, '2026-03-01', [[b, 5], [ctx.acc('opening_balance'), -5]])
  await assert.rejects(ctx.db.batch([update(ctx, 'accounts', b, { deleted_at: Date.now() })]), /account_has_lines/)
  await assert.rejects(ctx.db.batch([update(ctx, 'accounts', b, { is_placeholder: 1 })]), /account_has_lines/)
  await ctx.db.batch([update(ctx, 'accounts', b, { name: 'B2', archived_at: Date.now() })])
})

test('lock_date freezes entries on or before it', async () => {
  const ctx = await fresh()
  const w = ctx.acc('Wallet')
  const fee = ctx.acc('bank_fee')
  const id = await entry(ctx, '2026-03-01', [[w, -5], [fee, 5]])
  const late = await entry(ctx, '2026-04-01', [[w, -5], [fee, 5]])
  await ctx.db.batch([{ sql: "UPDATE settings SET value = '2026-03-31' WHERE key = 'lock_date'" }])
  await assert.rejects(entry(ctx, '2026-03-31', [[w, -5], [fee, 5]]), /period_locked/)
  await assert.rejects(ctx.db.batch([update(ctx, 'entries', id, { state: 'draft' })]), /period_locked/)
  await assert.rejects(ctx.db.batch([update(ctx, 'entries', id, { deleted_at: Date.now() })]), /period_locked/)
  await assert.rejects(ctx.db.batch([update(ctx, 'entries', late, { state: 'draft' }), update(ctx, 'entries', late, { entry_date: '2026-03-15' })]), /period_locked/)
  await ctx.db.batch([update(ctx, 'entries', late, { description: 'ok after lock' })])
  await assert.rejects(ctx.db.batch([{ sql: "UPDATE settings SET value = 'soon' WHERE key = 'lock_date'" }]), /CHECK/)
})

test('base currency is fixed', async () => {
  const ctx = await fresh()
  await assert.rejects(ctx.db.batch([{ sql: "UPDATE settings SET value = 'EUR' WHERE key = 'base_currency'" }]), /base_currency_fixed/)
  await ctx.db.batch([{ sql: "UPDATE settings SET value = 'tr' WHERE key = 'language'" }])
})

test('audit_log records every write with its actor and cannot change', async () => {
  const ctx = await fresh()
  const id = await entry(ctx, '2026-03-01', [[ctx.acc('Wallet'), -5], [ctx.acc('bank_fee'), 5]])
  await ctx.db.batch([update(ctx, 'entries', id, { deleted_at: Date.now() })])
  const log = await ctx.db.query("SELECT op, actor_id, json_extract(new, '$.number') AS number FROM audit_log WHERE table_name = 'entries' ORDER BY id")
  // insert, post, number assigned, soft delete
  assert.deepEqual(log.map((r) => r.op), ['insert', 'update', 'update', 'delete'])
  assert.ok(log.every((r) => r.actor_id === ctx.actor))
  assert.equal(log[2].number, 1)
  assert.equal((await one(ctx.db, "SELECT count(*) AS n FROM audit_log WHERE table_name = 'lines' AND op = 'delete'")).n, 2)
  await assert.rejects(ctx.db.batch([{ sql: "UPDATE audit_log SET op = 'insert'" }]), /log_immutable/)
})

test('activity_log rows are pruned only after activity_log_days', async () => {
  const ctx = await fresh()
  const old = Date.now() - 400 * 86_400_000
  await ctx.db.batch([
    { sql: 'INSERT INTO activity_log (actor_id, operation, ok, at) VALUES (?, ?, 1, ?)', params: [ctx.actor, 'old', old] },
    { sql: 'INSERT INTO activity_log (actor_id, operation, ok) VALUES (?, ?, 1)', params: [ctx.actor, 'new'] },
  ])
  await ctx.db.batch([{ sql: "DELETE FROM activity_log WHERE operation = 'old'" }])
  await assert.rejects(ctx.db.batch([{ sql: "DELETE FROM activity_log WHERE operation = 'new'" }]), /log_immutable/)
  await assert.rejects(ctx.db.batch([{ sql: "UPDATE activity_log SET ok = 0" }]), /log_immutable/)
})

test('pruneActivityLog drops only rows older than activity_log_days', async () => {
  const ctx = await fresh()
  const old = Date.now() - 400 * 86_400_000
  await ctx.db.batch([
    { sql: 'INSERT INTO activity_log (actor_id, operation, ok, at) VALUES (?, ?, 1, ?)', params: [ctx.actor, 'old', old] },
    { sql: 'INSERT INTO activity_log (actor_id, operation, ok) VALUES (?, ?, 1)', params: [ctx.actor, 'new'] },
  ])
  await pruneActivityLog(ctx.db)
  assert.deepEqual((await ctx.db.query('SELECT operation FROM activity_log')).map((r) => r.operation), ['new'])
})

test('balance query reads only the covering index', async () => {
  const ctx = await fresh()
  const plan = await ctx.db.query(
    'EXPLAIN QUERY PLAN SELECT account_id, sum(base_amount) FROM lines WHERE deleted_at IS NULL AND entry_date <= ? GROUP BY account_id',
    ['2026-12-31'],
  )
  assert.match(plan.map((r) => r.detail).join('\n'), /COVERING INDEX lines_account/)
})

test('0005 and 0006 keep every row and id when they rebuild tables', async () => {
  const db = openNodeDb()
  const all = readMigrations()
  await migrate(db, all.slice(0, 4))
  await db.batch([{
    sql: `INSERT INTO actors (uid, created_by, updated_by, kind, name, role) VALUES (lower(hex(randomblob(18))), 1, 1, 'user', 'T', 'admin')`,
  }])
  const count = async () => (await db.query('SELECT (SELECT count(*) FROM actors) a, (SELECT count(*) FROM audit_log) l, (SELECT count(*) FROM settings) s')) [0]
  const before = await count()
  await migrate(db, all)
  assert.deepEqual(await count(), before)
  assert.deepEqual(await db.query('PRAGMA foreign_key_check'), [])
  assert.deepEqual((await db.query(`SELECT 1 FROM pragma_table_info('actors') WHERE name = 'uid'`)), [])
  assert.equal((await db.query('SELECT name FROM actors WHERE id = 2'))[0].name, 'T')
})

test('every table but the logs has the six audit columns; deleted_by pairs with deleted_at', async () => {
  const ctx = await fresh()
  const tables = ['currencies', 'actors', 'settings', 'fx_rates', 'accounts', 'entries', 'lines', 'member_pins']
  for (const t of tables) {
    const cols = (await ctx.db.query(`SELECT name FROM pragma_table_info('${t}')`)).map((c) => c.name)
    for (const c of ['created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at', 'deleted_by']) assert.ok(cols.includes(c), `${t}.${c}`)
  }
  const a = await account(ctx, 'asset', 'Audit cash')
  const b = await account(ctx, 'equity', 'Audit capital')
  const id = await entry(ctx, '2026-03-01', [[a, 5], [b, -5]])
  await ctx.db.batch([update(ctx, 'entries', id, { deleted_at: Date.now() })])
  const [e] = await ctx.db.query('SELECT deleted_by FROM entries WHERE id = ?', [id])
  assert.equal(e.deleted_by, ctx.actor)
  const lines = await ctx.db.query('SELECT deleted_by FROM lines WHERE entry_id = ?', [id])
  assert.ok(lines.length === 2 && lines.every((l) => l.deleted_by === ctx.actor))
  await assert.rejects(ctx.db.batch([update(ctx, 'settings', 1, { deleted_at: Date.now() })]), /no_delete/)
})
