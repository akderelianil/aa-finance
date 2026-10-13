// Typed amounts ↔ integer minor units: parsing, validation, conversion. No float math.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { amountIssue, currencySymbol, fromBase, parseDecimal, tidyAmount, toDecimal, toMinor, today } from './amount.ts'

test('parseDecimal accepts both separator styles and returns a canonical string', () => {
  assert.equal(parseDecimal('1234.56', 2), '1234.56')
  assert.equal(parseDecimal('1.234,56', 2), '1234.56')
  assert.equal(parseDecimal('1234,5', 2), '1234.5')
  assert.equal(parseDecimal(' 1 234,56 ', 2), '1234.56')
  assert.equal(parseDecimal('12', 2), '12')
  assert.equal(parseDecimal('1.000.000,00', 2), '1000000.00')
})

test('parseDecimal rejects empty, malformed, negative and over-precise input', () => {
  for (const bad of ['', '   ', 'abc', '-5', '1,2,3', '1.2.3', '12.', '.5', '1e3', '€5', '١٢']) assert.equal(parseDecimal(bad, 2), null, bad)
  assert.equal(parseDecimal('1.234', 2), null)
  assert.equal(parseDecimal('1,234', 2), null)
  assert.equal(parseDecimal('1.5', 0), null)
  assert.equal(parseDecimal('15', 0), '15')
})

test('toMinor converts without float error and handles zero-decimal currencies', () => {
  assert.equal(toMinor('1234.56', 2), 123456)
  assert.equal(toMinor('0.07', 2), 7)
  assert.equal(toMinor('19.9', 2), 1990)
  assert.equal(toMinor('0.29', 2), 29)
  assert.equal(toMinor('500', 0), 500)
  assert.equal(toMinor('1.234', 3), 1234)
  assert.equal(toMinor('0', 2), 0)
})

test('toDecimal pads small amounts, drops the sign and handles zero exponent', () => {
  assert.equal(toDecimal(123456, 2), '1234.56')
  assert.equal(toDecimal(5, 2), '0.05')
  assert.equal(toDecimal(0, 2), '0.00')
  assert.equal(toDecimal(-250, 2), '2.50')
  assert.equal(toDecimal(500, 0), '500')
  assert.equal(toDecimal(1, 3), '0.001')
})

test('toDecimal and toMinor round-trip', () => {
  for (const minor of [0, 1, 99, 100, 123456, Number.MAX_SAFE_INTEGER]) assert.equal(toMinor(toDecimal(minor, 2), 2), minor)
})

test('amountIssue names what is wrong and returns null for empty or good input', () => {
  assert.equal(amountIssue('', 2), null)
  assert.equal(amountIssue('   ', 2), null)
  assert.equal(amountIssue('12,50', 2), null)
  assert.equal(amountIssue('abc', 2), 'format')
  assert.equal(amountIssue('-1', 2), 'format')
  assert.equal(amountIssue('1.234', 2), 'decimals')
  assert.equal(amountIssue('1,5', 0), 'decimals')
  assert.equal(amountIssue('0', 2), 'zero')
  assert.equal(amountIssue('0,00', 2), 'zero')
})

test('amountIssue flags amounts above the limit and allows the limit itself', () => {
  assert.equal(amountIssue('1000000000000', 2), null)
  assert.equal(amountIssue('1000000000000,01', 2), 'large')
  assert.equal(amountIssue('99999999999999', 2), 'large')
})

test('tidyAmount pads decimals to the currency exponent and leaves invalid text alone', () => {
  assert.equal(tidyAmount('12', 2), '12.00')
  assert.equal(tidyAmount('12,5', 2), '12.50')
  assert.equal(tidyAmount('1.234,5', 2), '1234.50')
  assert.equal(tidyAmount('12', 0), '12')
  assert.equal(tidyAmount('abc', 2), 'abc')
  assert.equal(tidyAmount('', 2), '')
  assert.equal(tidyAmount('1.234', 2), '1.234')
})

test('today is an ISO date of the local day', () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/)
})

test('fromBase converts base minor units at a rate, rounding half away from zero', () => {
  assert.equal(fromBase(3410, '34.1', 2, 2), 100)
  assert.equal(fromBase(100, '2', 2, 2), 50)
  assert.equal(fromBase(101, '2', 2, 2), 51)
  assert.equal(fromBase(-101, '2', 2, 2), -51)
  assert.equal(fromBase(100, '3', 2, 2), 33)
  assert.equal(fromBase(200, '3', 2, 2), 67)
  assert.equal(fromBase(0, '34.1', 2, 2), 0)
})

test('fromBase handles different exponents and a zero rate', () => {
  assert.equal(fromBase(3400, '34', 2, 0), 1)
  assert.equal(fromBase(100, '1', 0, 2), 10000)
  assert.equal(fromBase(100, '0', 2, 2), 0)
  assert.equal(fromBase(100, '0.00', 2, 2), 0)
})

test('currencySymbol returns a non-empty string for known and unknown-looking codes', () => {
  assert.ok(currencySymbol('USD').length > 0)
  assert.ok(currencySymbol('TRY').length > 0)
  assert.equal(currencySymbol('XTS').length > 0, true)
})
