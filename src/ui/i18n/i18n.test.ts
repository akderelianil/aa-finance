// Every API operation and error code has text in both languages; the two languages have the same keys.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ops } from '../../core/api/index.ts'
import { allErrorCodes } from '../../core/test/error-codes.ts'
import { en } from './en.ts'
import { tr } from './tr.ts'

/** Write ops that show no toast: setup is a full screen flow, deleteAll has its own confirm dialog. */
const NO_TOAST = new Set(['setup.run', 'entries.deleteAll'])

const keys = (o: object) => Object.keys(o).sort()

test('every write op except the listed ones has toast text in tr and en', () => {
  const writes = Object.keys(ops).filter((name) => ops[name as keyof typeof ops].write && !NO_TOAST.has(name))
  for (const [lang, ui] of [['tr', tr], ['en', en]] as const)
    for (const name of writes) {
      const text = (ui.ops as Record<string, { pending?: string; done?: string }>)[name]
      assert.ok(text?.pending && text?.done, `${lang}: ops.${name} needs pending and done`)
    }
})

test('no toast text for an op that does not exist', () => {
  for (const ui of [tr, en]) for (const name of Object.keys(ui.ops)) assert.ok(name in ops, `ops.${name} is not an API op`)
})

test('every error code the API can produce has a message in tr and en', () => {
  const codes = allErrorCodes().map((c) => c.code)
  for (const [lang, ui] of [['tr', tr], ['en', en]] as const)
    for (const code of codes) assert.ok(code in ui.errors, `${lang}: errors.${code} is missing`)
})

test('tr and en have the same keys', () => {
  assert.deepEqual(keys(en.errors), keys(tr.errors))
  assert.deepEqual(keys(en.ops), keys(tr.ops))
})
