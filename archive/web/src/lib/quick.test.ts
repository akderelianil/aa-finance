import assert from 'node:assert/strict'
import { test } from 'node:test'
import { debtLines, mulDivRound, scaleMinor, transferLines } from './quick.ts'

test('scaleMinor: exact, half up, exponents differ', () => {
  assert.equal(scaleMinor(10000, '34.5', 2, 2), 345000) // 100.00 USD → 3450.00 TRY
  assert.equal(scaleMinor(1, '0.5', 2, 2), 1) // 0.5 rounds up
  assert.equal(scaleMinor(1, '0.4999', 2, 2), 0)
  assert.equal(scaleMinor(100, '1.5', 0, 2), 15000) // JPY (exp 0) → 2-decimal base
  assert.equal(scaleMinor(1, 'abc', 2, 2), null)
})

test('scaleMinor: no float error on large amounts', () => {
  // 9_007_199_254_740_993 minor units is beyond 2^53; float math would lose the last digit.
  assert.equal(scaleMinor(900719925474099, '1.1', 2, 2), 990791918021509) // 900719925474099 * 1.1 = ...508.9 → ...509
})

test('mulDivRound: proportional split is exact', () => {
  assert.equal(mulDivRound(1000, 1n, 3n), 333)
  assert.equal(mulDivRound(1000, 2n, 3n), 667)
})

test('transferLines: fee line and source line balance in base', () => {
  const fx = { base: 'TRY', exp: () => 2, rate: () => undefined }
  const acc = (id: string) => ({ id, currency: 'TRY' }) as never
  const lines = transferLines(fx, acc('a'), acc('b'), 10000, null, 333, acc('fee'))!
  const sum = (side: string) => lines.filter((l) => l.side === side).reduce((s, l) => s + Number(l.amount), 0)
  assert.equal(sum('debit'), sum('credit'))
})

test('debtLines: each mode books money and the debt account on the right side', () => {
  const fx = { base: 'TRY', exp: () => 2, rate: () => undefined }
  const money = { id: 'cash', currency: 'TRY' } as never
  const payable = { id: 'payable', currency: 'TRY' } as never
  const receivable = { id: 'receivable', currency: 'TRY' } as never
  const sides = (l: ReturnType<typeof debtLines>) => l!.map((x) => `${x.side}:${x.account_id}:${x.amount}`).sort()
  assert.deepEqual(sides(debtLines(fx, 'borrow', money, payable, 5000, null)), ['credit:payable:50.00', 'debit:cash:50.00'])
  assert.deepEqual(sides(debtLines(fx, 'pay', money, payable, 5000, null)), ['credit:cash:50.00', 'debit:payable:50.00'])
  assert.deepEqual(sides(debtLines(fx, 'lend', money, receivable, 5000, null)), ['credit:cash:50.00', 'debit:receivable:50.00'])
  assert.deepEqual(sides(debtLines(fx, 'collect', money, receivable, 5000, null)), ['credit:receivable:50.00', 'debit:cash:50.00'])
})

test('debtLines: foreign money account books the debt amount in base', () => {
  const fx = { base: 'TRY', exp: () => 2, rate: () => '40' }
  const usd = { id: 'usd', currency: 'USD' } as never
  const payable = { id: 'payable', currency: 'TRY' } as never
  const lines = debtLines(fx, 'borrow', usd, payable, 10000, 400000)!
  assert.deepEqual(lines.find((l) => l.account_id === 'usd'), { account_id: 'usd', side: 'debit', amount: '100.00', base_amount: '4000.00' })
  assert.equal(lines.find((l) => l.account_id === 'payable')?.amount, '4000.00')
})
