// The generated API reference matches the code. Fix a failure with `npm run docs:api`.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { REFERENCE_PATH, render } from './gen-api-docs.ts'

test('docs/backend/api/reference.md is up to date', () => {
  assert.equal(readFileSync(REFERENCE_PATH, 'utf8'), render(), 'run `npm run docs:api` and commit the result')
})

test('the reference lists every op and error code once', () => {
  const text = render()
  assert.match(text, /\| `entries\.post` \| write \|/)
  assert.match(text, /\| `members\.signIn` \| write \| open \|/)
  assert.match(text, /\| `entry_unbalanced` \| trigger \|/)
  assert.match(text, /\| `account_name_taken` \| unique \|/)
  assert.equal((text.match(/\| `locked` \|/g) ?? []).length, 1)
})
