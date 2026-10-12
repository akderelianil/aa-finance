import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rateOf, toBase } from './money.ts'

test('toBase converts minor units and rounds half away from zero', () => {
  assert.equal(toBase(10000, '34.1', 2, 2), 341000) // 100.00 USD → 3410.00 TRY
  assert.equal(toBase(-10000, '34.1', 2, 2), -341000)
  assert.equal(toBase(1, '0.5', 2, 2), 1)
  assert.equal(toBase(-1, '0.5', 2, 2), -1)
  assert.equal(toBase(1, '0.49', 2, 2), 0)
  assert.equal(toBase(1000, '0.2155', 0, 2), 21550) // 1000 JPY → 215.50 TRY
  assert.equal(toBase(1234, '35', 2, 0), 432) // 12.34 → 431.9 in a 0-decimal base
})

test('rateOf gives back the rate of two amounts', () => {
  assert.equal(rateOf(10000, 340000, 2, 2), '34')
  assert.equal(rateOf(-10000, -341050, 2, 2), '34.105')
  assert.equal(rateOf(300, 1000, 2, 2), '3.333333333333')
  assert.equal(rateOf(1000, 21550, 0, 2), '0.2155')
  assert.equal(toBase(1000, rateOf(1000, 21550, 0, 2), 0, 2), 21550)
})
