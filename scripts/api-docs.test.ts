// The readable API reference is generated from the contract, so it cannot drift from it.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { describeSchema, renderApi, type Contract } from './api-docs.ts'

test('describeSchema names refs, marks optional fields and spells out lists and choices', () => {
  const schema = {
    type: 'object',
    required: ['id'],
    properties: {
      id: { $ref: '#/$defs/DocId' },
      memo: { type: ['string', 'null'] },
      lines: { type: 'array', items: { $ref: '#/$defs/Line' } },
      kind: { enum: ['asset', 'income'] },
    },
  }
  assert.equal(
    describeSchema(schema),
    '{ id: `DocId`, memo?: `string or null`, lines?: list of `Line`, kind?: `asset` | `income` }',
  )
})

test('renderApi lists every operation with its input, output and errors', () => {
  const contract: Contract = {
    title: 'T',
    description: 'D',
    api_version: '1',
    global_errors: ['internal'],
    operations: {
      undo: { summary: 'Back.', input: { type: 'object', properties: {} }, output: { $ref: '#/$defs/DocRef' }, errors: ['nothing_to_undo'] },
    },
    $defs: { DocRef: { type: 'object', properties: {} }, ErrorCode: { enum: ['internal', 'nothing_to_undo'] } },
  }
  const text = renderApi(contract)
  assert.match(text, /### `undo`/)
  assert.match(text, /- Output: `DocRef`/)
  assert.match(text, /- Errors: `nothing_to_undo`/)
  assert.match(text, /Every operation can also return: `internal`/)
})

test('the real contract renders every operation it defines', () => {
  const contract = JSON.parse(readFileSync(new URL('../api/v1/api.json', import.meta.url), 'utf8')) as Contract
  const text = renderApi(contract)
  for (const name of Object.keys(contract.operations)) assert.ok(text.includes(`### \`${name}\``), name)
})
