import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatLocale } from './locale.ts'

test('formatLocale gives the country locale, whatever the UI language', () => {
  assert.equal(formatLocale('TR', 'en'), 'tr-Latn-TR')
  assert.equal(formatLocale('DE', 'tr'), 'de-Latn-DE')
})

test('formatLocale falls back to the UI language with no country or a bad region', () => {
  assert.equal(formatLocale(null, 'tr'), 'tr')
  assert.equal(formatLocale(undefined, 'en'), 'en')
  assert.equal(formatLocale('', 'en'), 'en')
  assert.equal(formatLocale('not a region', 'tr'), 'tr')
})
