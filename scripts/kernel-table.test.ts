// The kernel table (ADR-0021) must name every rule code and point only at tests that exist.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkKernelTable, extractRuleCodes, extractTestAnchors, findProblems } from './kernel-table.ts'

const ERROR_RS = `
match self {
    RuleCode::ProjectionClosed => "projection_closed",
    RuleCode::EntryUnbalanced => "entry_unbalanced",
}
`

test('extractRuleCodes reads the code strings of the as_str match and nothing else', () => {
  assert.deepEqual(extractRuleCodes(ERROR_RS + 'let x = "not_a_code";'), ['projection_closed', 'entry_unbalanced'])
})

test('extractTestAnchors reads the test names after a file name and skips rows without names', () => {
  const adr = [
    '| K1 | a | trigger | `entry_unbalanced` | store/entries.rs: `first_test`, `second_test`; store/verify.rs: `third_test` |',
    '| K2 | b | trigger | `projection_closed` | store/revisions.rs (parent mismatch) |',
  ].join('\n')
  assert.deepEqual(extractTestAnchors(adr), ['first_test', 'second_test', 'third_test'])
})

test('findProblems reports a code missing from the table and a test that does not exist', () => {
  const adr = '| K1 | a | t | `projection_closed` | store/x.rs: `gone_test`, `kept_test` |'
  const problems = findProblems(['projection_closed', 'entry_unbalanced'], adr, new Set(['kept_test']))
  assert.deepEqual(problems, [
    'rule code entry_unbalanced is not in ADR-0021',
    'test gone_test named in ADR-0021 does not exist',
  ])
})

test('findProblems is empty when every code and test is accounted for', () => {
  const adr = '| K1 | a | t | `projection_closed` | store/x.rs: `kept_test` |'
  assert.deepEqual(findProblems(['projection_closed'], adr, new Set(['kept_test'])), [])
})

test('the real ADR-0021 names every rule code and only existing tests', () => {
  assert.deepEqual(checkKernelTable(), [])
})
