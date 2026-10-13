// Writes CHANGELOG.md from the git history: Conventional Commit subjects grouped by day and type.
// Run: npm run changelog. Subjects that are not Conventional Commits (older history) are left out.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export type Commit = { hash: string; date: string; subject: string }
type Parsed = { type: string; scope: string | null; breaking: boolean; text: string }

export const CHANGELOG_PATH = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url))

/** Order and titles of the sections. A type not listed here is not shown. */
const SECTIONS: [type: string, title: string][] = [
  ['feat', 'Features'], ['fix', 'Fixes'], ['perf', 'Performance'], ['refactor', 'Refactoring'],
  ['docs', 'Documentation'], ['test', 'Tests'], ['ci', 'CI'], ['build', 'Build'], ['chore', 'Chores'], ['ecc', 'Tooling (ECC)'],
]

const SUBJECT = /^([a-z]+)(?:\(([^)]+)\))?(!)?: (.+)$/

export function parseSubject(subject: string): Parsed | null {
  const m = SUBJECT.exec(subject)
  if (!m) return null
  return { type: m[1], scope: m[2] ?? null, breaking: m[3] === '!', text: m[4] }
}

export function renderChangelog(commits: Commit[]): string {
  const known = new Set(SECTIONS.map(([type]) => type))
  const days = [...new Set(commits.map((c) => c.date))].sort().reverse()
  const out = ['# Changelog', '', 'Generated from Conventional Commits by `npm run changelog`. Do not edit by hand.', '']
  for (const day of days) {
    const parsed = commits
      .filter((c) => c.date === day)
      .flatMap((c) => { const p = parseSubject(c.subject); return p && known.has(p.type) ? [{ c, p }] : [] })
    if (!parsed.length) continue
    out.push(`## ${day}`, '')
    for (const [type, title] of SECTIONS) {
      const rows = parsed.filter(({ p }) => p.type === type)
      if (!rows.length) continue
      out.push(`### ${title}`)
      for (const { c, p } of rows) out.push(`- ${p.breaking ? '**BREAKING** ' : ''}${p.scope ? `**${p.scope}:** ` : ''}${p.text} (${c.hash.slice(0, 7)})`)
      out.push('')
    }
  }
  return out.join('\n')
}

function gitCommits(): Commit[] {
  const log = execFileSync('git', ['log', '--format=%H%x09%ad%x09%s', '--date=short'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  return log.split('\n').filter(Boolean).map((line) => {
    const [hash, date, ...subject] = line.split('\t')
    return { hash, date, subject: subject.join('\t') }
  })
}

if (import.meta.main) {
  writeFileSync(CHANGELOG_PATH, renderChangelog(gitCommits()))
  console.log(`wrote ${CHANGELOG_PATH}`)
}
