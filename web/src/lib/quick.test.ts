import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mulDivRound, scaleMinor, transferLines } from './quick.ts'

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

test('debt via transferLines: borrow debits money, credits the payable account', () => {
  const fx = { base: 'TRY', exp: () => 2, rate: () => undefined }
  const acc = (id: string) => ({ id, currency: 'TRY' }) as never
  const lines = transferLines(fx, acc('payable'), acc('bank'), 500000, null, 0, null)!
  assert.deepEqual(lines.map((l) => [l.account_id, l.side, l.amount]), [['bank', 'debit', '5000.00'], ['payable', 'credit', '5000.00']])
})
