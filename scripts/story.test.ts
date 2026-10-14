// npm run story finds the story-lifecycle ledger in the ECC plugin cache, whatever version is installed.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { findLedger } from './story.ts'

function fakeCache(versions: string[], withLedger: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'story-'))
  for (const v of versions) {
    const dir = join(root, v, 'skills', 'story-lifecycle', 'scripts')
    mkdirSync(dir, { recursive: true })
    if (withLedger.includes(v)) writeFileSync(join(dir, 'ledger.js'), '')
  }
  return root
}

test('findLedger picks the highest version that has a ledger', () => {
  const root = fakeCache(['2.2.3', '2.10.0', '2.9.1'], ['2.2.3', '2.10.0', '2.9.1'])
  try {
    assert.equal(findLedger(root), join(root, '2.10.0', 'skills', 'story-lifecycle', 'scripts', 'ledger.js'))
  } finally { rmSync(root, { recursive: true }) }
})

test('findLedger skips versions without a ledger', () => {
  const root = fakeCache(['2.2.3', '2.3.0'], ['2.2.3'])
  try {
    assert.equal(findLedger(root), join(root, '2.2.3', 'skills', 'story-lifecycle', 'scripts', 'ledger.js'))
  } finally { rmSync(root, { recursive: true }) }
})

test('findLedger returns null when the cache is missing or empty', () => {
  assert.equal(findLedger(join(tmpdir(), 'no-such-ecc-cache')), null)
  const root = fakeCache(['2.2.3'], [])
  try {
    assert.equal(findLedger(root), null)
  } finally { rmSync(root, { recursive: true }) }
})
