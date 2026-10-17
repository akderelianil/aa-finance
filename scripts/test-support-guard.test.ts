// The guard that keeps the test-support feature out of shipped builds.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findLeaks } from './test-support-guard.ts'

test('findLeaks reports a crate whose features include test-support and nothing else', () => {
  const tree = [
    'aa-core v0.0.0 (/x/crates/core) [test-support]',
    'aa-app v0.0.0 (/x/crates/app) [a,test-support,b]',
    'rusqlite v0.40.2 [bundled,uuid]',
    'aa-core v0.0.0 (/x/crates/core) []',
    'other v1.0.0 [test-supported]',
  ].join('\n')
  assert.deepEqual(findLeaks(tree), [
    'aa-core v0.0.0 (/x/crates/core) [test-support]',
    'aa-app v0.0.0 (/x/crates/app) [a,test-support,b]',
  ])
})

test('findLeaks is empty for a clean tree', () => {
  assert.deepEqual(findLeaks('aa-core v0.0.0 (/x) []\nserde v1 [derive]'), [])
})
