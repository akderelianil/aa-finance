// Guard for the rule "never edit an applied migration": only new migration files may be written.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decide } from './guard-migrations.ts'

const root = '/repo'
const tracked = (...paths: string[]) => (file: string) => paths.includes(file)

test('blocks a write to a tracked migration', () => {
  const file = `${root}/src/core/migrations/0004_x.sql`
  const out = decide({ tool_name: 'Edit', tool_input: { file_path: file } }, root, tracked(file))
  assert.equal(out.block, true)
  assert.match(out.reason, /applied migration/i)
})

test('allows a brand-new migration file', () => {
  const file = `${root}/src/core/migrations/0013_new.sql`
  assert.equal(decide({ tool_name: 'Write', tool_input: { file_path: file } }, root, tracked()).block, false)
})

test('ignores other files and other tools', () => {
  const sql = `${root}/src/core/migrations/0004_x.sql`
  assert.equal(decide({ tool_name: 'Edit', tool_input: { file_path: `${root}/src/core/api/index.ts` } }, root, () => true).block, false)
  assert.equal(decide({ tool_name: 'Read', tool_input: { file_path: sql } }, root, () => true).block, false)
  assert.equal(decide({ tool_name: 'Edit', tool_input: {} }, root, () => true).block, false)
  assert.equal(decide({}, root, () => true).block, false)
})

test('matches relative paths and non-sql files in the folder', () => {
  const out = decide({ tool_name: 'MultiEdit', tool_input: { file_path: 'src/core/migrations/0001_schema.sql' } }, root, () => true)
  assert.equal(out.block, true)
  assert.equal(decide({ tool_name: 'Edit', tool_input: { file_path: `${root}/src/core/migrations/notes.md` } }, root, () => true).block, false)
})
