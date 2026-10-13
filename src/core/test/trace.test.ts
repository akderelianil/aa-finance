// The rule-to-test trace stays honest: every test it names exists, and every Product rule is traced.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { allTestTitles, namedTests } from './trace.ts'

const repo = new URL('../../../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, repo), 'utf8')

test('namedTests reads test cells and lines, skipping NONE', () => {
  const md = '| R-1 | `account_locked` | test: first one |\n| R-2 | x | test: NONE |\n- test: second one\n'
  assert.deepEqual(namedTests(md), ['first one', 'second one'])
})

test('allTestTitles finds titles from this repo', () => {
  assert.ok(allTestTitles().has('namedTests reads test cells and lines, skipping NONE'))
})

test('every test named in docs/RULES-TRACE.md exists', () => {
  assert.ok(existsSync(new URL('docs/RULES-TRACE.md', repo)), 'docs/RULES-TRACE.md is missing')
  const titles = allTestTitles()
  const named = namedTests(read('docs/RULES-TRACE.md'))
  assert.ok(named.length >= 10, 'the trace should name the tests behind the Product rules')
  for (const title of named) assert.ok(titles.has(title), `no test titled "${title}"`)
})

test('every test named in docs/backend/specs exists', () => {
  const specs = new URL('docs/backend/specs/', repo)
  const files = existsSync(specs) ? readdirSync(specs, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.md')) : []
  assert.ok(files.length > 0, 'docs/backend/specs/ has no specs')
  const titles = allTestTitles()
  for (const file of files)
    for (const title of namedTests(readFileSync(new URL(file, specs), 'utf8'))) assert.ok(titles.has(title), `${file}: no test titled "${title}"`)
})

test('every bullet under "Product rules" in CLAUDE.md has a row in the trace', () => {
  const claude = read('CLAUDE.md')
  const section = claude.slice(claude.indexOf('## Product rules'), claude.indexOf('## Engineering rules'))
  const bullets = section.split('\n').filter((l) => l.startsWith('- ')).length
  const rows = (read('docs/RULES-TRACE.md').match(/^\| PR-\d+ \|/gm) ?? []).length
  assert.equal(rows, bullets, `CLAUDE.md has ${bullets} product rules, the trace has ${rows} rows (PR-1…)`)
})
