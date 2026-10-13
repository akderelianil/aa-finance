import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearKept, getKept, setKept } from './kept.ts'

test('kept state is per member and survives until cleared', () => {
  setKept(1, 'quick.description', 'taksi')
  setKept(2, 'quick.description', 'kira')
  assert.equal(getKept(1, 'quick.description'), 'taksi')
  assert.equal(getKept(2, 'quick.description'), 'kira')
  assert.equal(getKept(3, 'quick.description'), undefined)
})

test('clearKept drops a prefix for one member only', () => {
  setKept(1, 'quick.open', true)
  setKept(1, 'draft', { id: null })
  setKept(2, 'quick.open', true)
  clearKept(1, 'quick.')
  assert.equal(getKept(1, 'quick.open'), undefined)
  assert.deepEqual(getKept(1, 'draft'), { id: null })
  assert.equal(getKept(2, 'quick.open'), true)
  clearKept(1)
  assert.equal(getKept(1, 'draft'), undefined)
})
