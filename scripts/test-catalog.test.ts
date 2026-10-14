// The test catalog is generated from the Rust test sources, so it cannot drift from them.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { collectGroups, extractTests, humanize, moduleDoc, renderCatalog } from './test-catalog.ts'

test('extractTests finds #[test] functions, also inside proptest blocks, and nothing else', () => {
  const source = `
fn helper() {}
#[test]
fn first_case() {}

proptest! {
    #[test]
    fn a_property(x in 0..5) {}
}
#[cfg(test)]
mod tests {
    #[test]
    fn nested_case() {}
}
// #[test] in a comment is followed by no function
`
  assert.deepEqual(extractTests(source), ['first_case', 'a_property', 'nested_case'])
})

test('moduleDoc joins the first paragraph of the //! comment', () => {
  const source = '//! Posting entries: balanced,\n//! and kept in history.\n//!\n//! More detail.\n\nuse x;\n'
  assert.equal(moduleDoc(source), 'Posting entries: balanced, and kept in history.')
  assert.equal(moduleDoc('use x;\n'), '')
})

test('humanize turns a test name into a sentence', () => {
  assert.equal(humanize('a_posted_entry_needs_two_lines'), 'A posted entry needs two lines')
})

function fakeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'catalog-'))
  const put = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  put('crates/core/tests/store/main.rs', '//! The binary.\nmod entries;\n')
  put('crates/core/tests/store/common.rs', '//! Helpers.\npub fn world() {}\n')
  put('crates/core/tests/store/entries.rs', '//! Posting entries.\n#[test]\nfn it_posts() {}\n#[test]\nfn it_balances() {}\n')
  put('crates/core/src/amount.rs', '//! Exact amounts.\n#[cfg(test)]\nmod tests {\n    #[test]\n    fn parses_text() {}\n}\n')
  put('crates/core/src/lib.rs', '//! The core.\npub mod amount;\n')
  return root
}

test('collectGroups lists files with tests, skips main.rs and helpers, and counts', () => {
  const root = fakeRepo()
  try {
    const groups = collectGroups(root)
    assert.deepEqual(
      groups.map((g) => [g.heading, g.sections.map((s) => [s.path, s.tests.length])]),
      [
        ['core: integration tests (crates/core/tests)', [['store/entries.rs', 2]]],
        ['core: unit tests (crates/core/src)', [['amount.rs', 1]]],
      ],
    )
  } finally { rmSync(root, { recursive: true }) }
})

test('renderCatalog is deterministic and shows the topic, the count and each test as a sentence', () => {
  const root = fakeRepo()
  try {
    const md = renderCatalog(collectGroups(root))
    assert.equal(md, renderCatalog(collectGroups(root)))
    assert.match(md, /^# Test catalog/)
    assert.match(md, /Total: 3 tests\./)
    assert.match(md, /### store\/entries\.rs \(2\)\nPosting entries\.\n\n- It posts\n- It balances\n/)
    assert.match(md, /### amount\.rs \(1\)\nExact amounts\.\n\n- Parses text\n/)
  } finally { rmSync(root, { recursive: true }) }
})
