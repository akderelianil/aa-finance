// Dev only: times the main reads on 10k entries (20k lines) through the API on node:sqlite.
// Run: npm run bench   (in memory; the numbers go to docs/LOCAL-FIRST.md "Measured")
import { createApi, type Input, type OpName } from '../../src/core/api/index.ts'
import { migrate } from '../../src/core/migrate.ts'
import { openNodeDb, readMigrations } from '../../src/core/test/node-db.ts'

const N = 10_000
const db = openNodeDb()
await migrate(db, readMigrations())
const api = createApi(db)
await api.call('setup.run', { baseCurrency: 'TRY', language: 'en', userName: 'Bench', recommended: true })
const accounts = await api.call('accounts.list', {})
const uid = (name: string) => accounts.find((a) => a.name === name)!.id
const [wallet, groceries, rent, salary] = ['Wallet', 'Groceries', 'Rent', 'Salary'].map(uid)

const ms = (t0: number) => `${Math.round(performance.now() - t0)} ms`
let t0 = performance.now()
for (let i = 0; i < N; i++) {
  const date = new Date(Date.UTC(2020, 0, 1 + Math.floor(i / 5))).toISOString().slice(0, 10)
  const [dr, cr] = i % 10 === 0 ? [wallet, salary] : [i % 3 ? groceries : rent, wallet]
  const amount = 100 + ((i * 7919) % 100_000)
  await api.call('entries.post', { date, lines: [{ account: dr, amount }, { account: cr, amount: -amount }] })
}
console.log(`entries.post x ${N}: ${ms(t0)}`)

async function time<K extends OpName>(label: string, op: K, input: Input<K>) {
  await api.call(op, input) // warm the statement cache
  const t = performance.now()
  await api.call(op, input)
  console.log(`${label}: ${ms(t)}`)
}
const last = N / 50 - 1 // the wallet is on every entry
await time('accounts.list (balances)', 'accounts.list', {})
await time('entries.list, first page', 'entries.list', {})
await time('entries.list, search', 'entries.list', { search: 'nothing' })
await time('register, first page', 'accounts.register', { id: wallet })
await time('register, last page', 'accounts.register', { id: wallet, page: last })
await time('trial balance', 'reports.trialBalance', {})
await time('balance sheet', 'reports.balanceSheet', {})
await time('income statement, one year', 'reports.incomeStatement', { from: '2023-01-01', to: '2023-12-31' })
await time('activity.list, first page', 'activity.list', {})
