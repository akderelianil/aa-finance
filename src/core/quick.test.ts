// Quick Entry builders, posted through the API so the database checks the result.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApi } from './api/index.ts'
import { migrate } from './migrate.ts'
import { debt, expense, income, transfer, type Book, type QuickAccount } from './quick.ts'
import { openNodeDb, readMigrations } from './test/node-db.ts'

async function fresh() {
  const db = openNodeDb()
  await migrate(db, readMigrations())
  const api = createApi(db)
  await api.call('setup.run', { baseCurrency: 'TRY', language: 'en', userName: 'Test', recommended: true })
  const minor = new Map((await api.call('currencies.list', {})).map((c) => [c.code, c.minorUnit]))
  const book: Book = { base: 'TRY', minor: (c) => minor.get(c)! }
  const all = async () => new Map((await api.call('accounts.list', {})).map((a) => [a.systemKey ?? a.name, a]))
  const add = async (parent: string, name: string, currency: string) => {
    await api.call('accounts.create', { parent: (await all()).get(parent)!.id, name, currency })
  }
  await add('bank', 'Akbank', 'TRY')
  await add('bank', 'USD Account', 'USD')
  await add('bank', 'EUR Account', 'EUR')
  await add('credit_cards', 'Card', 'TRY')
  const accs = await all()
  const acc = (k: string): QuickAccount => accs.get(k) ?? assert.fail(`no account ${k}`)
  const post = async (input: ReturnType<typeof expense>) => {
    const e = await api.call('entries.post', input)
    return (await api.call('entries.get', { id: e.id })).lines.map((l) => [l.account, l.amount, l.baseAmount])
  }
  return { api, book, acc, post }
}

test('expense: splits on a card; a foreign payment converts with the last split taking the rounding', async () => {
  const { book, acc, post } = await fresh()
  const card = acc('Card')
  const [g, r] = [acc('Groceries'), acc('Restaurants')]
  assert.deepEqual(
    await post(expense(book, { date: '2026-03-01', from: card, total: 50000, splits: [{ account: g, amount: 30000 }, { account: r, amount: 20000 }] })),
    [[card.id, -50000, -50000], [g.id, 30000, 30000], [r.id, 20000, 20000]],
  )
  const usd = acc('USD Account')
  // 3 × 0.01 USD at 33.335: 0.33335 TRY each; total 0.03 USD → 1.00 TRY.
  assert.deepEqual(
    await post(expense(book, { date: '2026-03-01', from: usd, total: 3, rate: '33.335', splits: [1, 1, 1].map((amount) => ({ account: g, amount })) })),
    [[usd.id, -3, -100], [g.id, 33, 33], [g.id, 33, 33], [g.id, 34, 34]],
  )
  assert.throws(() => expense(book, { date: '2026-03-01', from: usd, total: 3, splits: [{ account: g, amount: 3 }] }), /quick_rate_required/)
  assert.throws(() => expense(book, { date: '2026-03-01', from: card, total: 5, splits: [{ account: g, amount: 4 }] }), /quick_split_mismatch/)
  assert.throws(() => expense(book, { date: '2026-03-01', from: card, total: 5, splits: [{ account: acc('Salary'), amount: 5 }] }), /quick_expense_account/)
})

test('income: received into an asset, split over income accounts', async () => {
  const { book, acc, post } = await fresh()
  const bank = acc('Akbank')
  const [s, b] = [acc('Salary'), acc('Bonus')]
  assert.deepEqual(
    await post(income(book, { date: '2026-03-01', to: bank, total: 15000, splits: [{ account: s, amount: 10000 }, { account: b, amount: 5000 }] })),
    [[bank.id, 15000, 15000], [s.id, -10000, -10000], [b.id, -5000, -5000]],
  )
  assert.throws(() => income(book, { date: '2026-03-01', to: acc('Card'), total: 1, splits: [{ account: s, amount: 1 }] }), /quick_receive_account/)
})

test('transfer: ATM with fee, card payment, and across currencies', async () => {
  const { book, acc, post } = await fresh()
  const [bank, wallet, card, fee] = [acc('Akbank'), acc('Wallet'), acc('Card'), acc('bank_fee')]
  assert.deepEqual(
    await post(transfer(book, { date: '2026-03-01', from: bank, to: wallet, amount: 100000, fee: 500, feeAccount: fee })),
    [[wallet.id, 100000, 100000], [fee.id, 500, 500], [bank.id, -100500, -100500]],
  )
  assert.deepEqual(
    await post(transfer(book, { date: '2026-03-01', from: bank, to: card, amount: 2000 })),
    [[card.id, 2000, 2000], [bank.id, -2000, -2000]],
  )
  const usd = acc('USD Account')
  // 100 USD sold for 3400 TRY, 1 USD fee: the rate (34) comes from the two amounts.
  assert.deepEqual(
    await post(transfer(book, { date: '2026-03-01', from: usd, to: bank, amount: 10000, toAmount: 340000, fee: 100, feeAccount: fee })),
    [[bank.id, 340000, 340000], [fee.id, 3400, 3400], [usd.id, -10100, -343400]],
  )
  // USD → EUR: neither is base, so the USD rate is needed.
  const eur = acc('EUR Account')
  assert.throws(() => transfer(book, { date: '2026-03-01', from: usd, to: eur, amount: 10000, toAmount: 9000 }), /quick_rate_required/)
  assert.deepEqual(
    await post(transfer(book, { date: '2026-03-01', from: usd, to: eur, amount: 10000, toAmount: 9000, rate: '34' })),
    [[eur.id, 9000, 340000], [usd.id, -10000, -340000]],
  )
  assert.throws(() => transfer(book, { date: '2026-03-01', from: bank, to: usd, amount: 1 }), /quick_amount_required/)
  assert.throws(() => transfer(book, { date: '2026-03-01', from: bank, to: bank, amount: 1 }), /quick_same_account/)
  assert.throws(() => transfer(book, { date: '2026-03-01', from: card, to: bank, amount: 1 }), /quick_from_account/)
})

test('debt: lend, borrow, collect, repay move the right sides', async () => {
  const { book, acc, post } = await fresh()
  const [wallet, bank, rec, pay] = [acc('Wallet'), acc('Akbank'), acc('receivables'), acc('payables')]
  const d = (kind: 'lend' | 'borrow' | 'collect' | 'repay', money: QuickAccount, account: QuickAccount, amount: number) =>
    post(debt(book, { date: '2026-03-01', kind, money, debt: account, amount }))
  assert.deepEqual(await d('borrow', bank, pay, 500000), [[bank.id, 500000, 500000], [pay.id, -500000, -500000]])
  assert.deepEqual(await d('lend', wallet, rec, 200000), [[rec.id, 200000, 200000], [wallet.id, -200000, -200000]])
  assert.deepEqual(await d('collect', wallet, rec, 50000), [[wallet.id, 50000, 50000], [rec.id, -50000, -50000]])
  assert.deepEqual(await d('repay', bank, pay, 100000), [[pay.id, 100000, 100000], [bank.id, -100000, -100000]])
  assert.throws(() => debt(book, { date: '2026-03-01', kind: 'lend', money: wallet, debt: pay, amount: 1 }), /quick_debt_account/)

  // A USD loan given from a TRY wallet: the debt side gets its own amount.
  const usd = acc('USD Account')
  assert.deepEqual(
    await post(debt(book, { date: '2026-03-01', kind: 'lend', money: wallet, debt: rec, amount: 340000 })),
    [[rec.id, 340000, 340000], [wallet.id, -340000, -340000]],
  )
  assert.deepEqual(
    await post(debt(book, { date: '2026-03-01', kind: 'collect', money: usd, debt: rec, amount: 10000, debtAmount: 340000 })),
    [[usd.id, 10000, 340000], [rec.id, -340000, -340000]],
  )
})
