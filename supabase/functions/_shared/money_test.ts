import { assertEquals, assertThrows } from 'jsr:@std/assert@1'
import { assertNotLocked, entryDate, parseAmount } from './entries.ts'
import { parseRate } from './fx.ts'
import { HttpError } from './http.ts'

Deno.test('parseAmount: exact minor units, no float', () => {
  assertEquals(parseAmount('12.34', 2), 1234n)
  assertEquals(parseAmount('0.10', 2), 10n)
  assertEquals(parseAmount('5', 0), 5n)
  assertEquals(parseAmount(7.5, 2), 750n)
  assertEquals(parseAmount('999999999999999', 0), 999999999999999n) // 10^15 - 1
})

Deno.test('parseAmount: rejects zero, too many decimals, too big, junk', () => {
  for (const [v, exp] of [['0', 2], ['0.00', 2], ['1.234', 2], ['1.5', 0], ['-1', 2], ['1e3', 2], ['', 2], [null, 2], ['1000000000000000', 0]] as const) {
    assertThrows(() => parseAmount(v, exp), HttpError)
  }
})

Deno.test('parseRate: decimal string, comma allowed, positive only', () => {
  assertEquals(parseRate('34,5'), '34.5')
  assertEquals(parseRate(undefined), null)
  assertEquals(parseRate(''), null)
  for (const v of ['0', '0.0', '-1', '1.12345678901', 'abc']) assertThrows(() => parseRate(v), HttpError)
})

Deno.test('entryDate: default today, rejects bad and far-future dates', () => {
  assertEquals(entryDate(undefined), new Date().toISOString().slice(0, 10))
  assertEquals(entryDate('2026-02-28'), '2026-02-28')
  for (const v of ['2026-02-30', '1999-12-31', '2999-01-01', 'x', 5]) assertThrows(() => entryDate(v), HttpError)
})

Deno.test('assertNotLocked: date on or before the lock date fails', () => {
  assertNotLocked(null, '2026-01-01')
  assertNotLocked('2026-01-31', '2026-02-01')
  assertThrows(() => assertNotLocked('2026-01-31', '2026-01-31'), HttpError)
  assertThrows(() => assertNotLocked('2026-01-31', '2026-01-01'), HttpError)
})
