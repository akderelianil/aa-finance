// Writes docs/backend/api/reference.md from the code: the op list and the error-code catalog.
// Run: npm run docs:api. A test fails when the committed file differs from render().
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { openOps, ops, type OpName } from '../src/core/api/index.ts'
import { allErrorCodes } from '../src/core/test/error-codes.ts'
import { en } from '../src/ui/i18n/en.ts'

export const REFERENCE_PATH = fileURLToPath(new URL('../docs/backend/api/reference.md', import.meta.url))

const ORIGIN_NOTE = { trigger: 'database trigger', unique: 'unique constraint', api: 'API check' } as const

/** Field names of an op's input object, or "-" when it takes none. */
function fields(name: OpName): string {
  const shape = (ops[name].input as unknown as { def?: { shape?: Record<string, unknown> } }).def?.shape
  const keys = shape ? Object.keys(shape) : []
  return keys.length ? keys.map((k) => `\`${k}\``).join(', ') : '-'
}

export function render(): string {
  const names = Object.keys(ops).sort() as OpName[]
  const messages = en.errors as Record<string, string>
  const lines = [
    '---',
    'owner: backend-engineer',
    'status: generated',
    '---',
    '',
    '# API reference (generated)',
    '',
    'Generated from `ops` in `src/core/api/index.ts`, `src/core/api/errors.ts` and `src/ui/i18n/en.ts` by `scripts/gen-api-docs.ts`. Do not edit by hand: run `npm run docs:api`. A test fails when this file is out of date. Behavior and rules: [operations](operations.md).',
    '',
    `## Operations (${names.length})`,
    '',
    '| Operation | Kind | Access | Input fields |',
    '|---|---|---|---|',
    ...names.map((n) => `| \`${n}\` | ${ops[n].write ? 'write' : 'read'} | ${openOps.has(n) ? 'open' : 'signed in'} | ${fields(n)} |`),
    '',
    '`open` ops run with no member signed in; every other op fails with `locked` (`not_setup` before setup).',
    '',
    `## Error codes (${allErrorCodes().length})`,
    '',
    '| Code | Origin | English message |',
    '|---|---|---|',
    ...allErrorCodes().map(({ code, origin }) => `| \`${code}\` | ${origin} | ${(messages[code] ?? '-').replaceAll('|', '\\|')} |`),
    '',
    `Origins: ${Object.entries(ORIGIN_NOTE).map(([k, v]) => `\`${k}\` = ${v}`).join(', ')}.`,
    '',
  ]
  return lines.join('\n')
}

if (import.meta.main) {
  writeFileSync(REFERENCE_PATH, render())
  console.log(`wrote ${REFERENCE_PATH}`)
}
