// The changelog is built from Conventional Commit subjects; anything else is left out.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSubject, renderChangelog, type Commit } from './gen-changelog.ts'

test('parseSubject reads type, scope and breaking marker', () => {
  assert.deepEqual(parseSubject('feat(ui): member grants'), { type: 'feat', scope: 'ui', breaking: false, text: 'member grants' })
  assert.deepEqual(parseSubject('fix!: drop old column'), { type: 'fix', scope: null, breaking: true, text: 'drop old column' })
  assert.equal(parseSubject('X1e: country sets the format'), null)
  assert.equal(parseSubject('Merge branch main'), null)
  assert.equal(parseSubject('wip'), null)
})

test('renderChangelog groups by type, newest first, and skips unknown types', () => {
  const commits: Commit[] = [
    { hash: 'aaaaaaa1', date: '2026-10-13', subject: 'feat(ui): grants' },
    { hash: 'bbbbbbb2', date: '2026-10-13', subject: 'fix: lock removed members' },
    { hash: 'ccccccc3', date: '2026-10-12', subject: 'docs: add ADRs' },
    { hash: 'ddddddd4', date: '2026-10-12', subject: 'L3 ui on reui' },
    { hash: 'eeeeeee5', date: '2026-10-12', subject: 'feat!: new gate' },
  ]
  const md = renderChangelog(commits)
  assert.match(md, /^# Changelog/)
  assert.match(md, /## 2026-10-13[\s\S]*### Features\n- \*\*ui:\*\* grants \(aaaaaaa\)/)
  assert.match(md, /### Fixes\n- lock removed members \(bbbbbbb\)/)
  assert.match(md, /### Documentation\n- add ADRs \(ccccccc\)/)
  assert.match(md, /- \*\*BREAKING\*\* new gate \(eeeeeee\)/)
  assert.doesNotMatch(md, /L3 ui on reui/)
  assert.ok(md.indexOf('## 2026-10-13') < md.indexOf('## 2026-10-12'))
})
