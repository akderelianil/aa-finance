// Writes docs/foundation/test-catalog.md from the Rust test sources: each test file by topic (its //!
// comment) with every test name as a sentence. `--check` fails when the file is out of date, so the
// catalog cannot drift. Run: npm run test:catalog   Check: npm run test:catalog:check
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export type Section = { path: string; description: string; tests: string[] }
export type Group = { heading: string; sections: Section[] }

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const CATALOG_PATH = join(ROOT, 'docs', 'foundation', 'test-catalog.md')

/** Names of the `#[test]` functions in a Rust source, in file order. */
export function extractTests(source: string): string[] {
  return [...source.matchAll(/^[ \t]*#\[test\]\s*\n\s*(?:pub\s+)?fn\s+(\w+)/gm)].map((m) => m[1])
}

/** The first paragraph of the `//!` comment at the top of a file, on one line. */
export function moduleDoc(source: string): string {
  const doc: string[] = []
  for (const line of source.split('\n')) {
    const m = /^\/\/!\s?(.*)$/.exec(line)
    if (!m || m[1].trim() === '') break
    doc.push(m[1].trim())
  }
  return doc.join(' ')
}

export function humanize(name: string): string {
  const text = name.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function rustFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) return rustFiles(full)
      return entry.endsWith('.rs') ? [full] : []
    })
}

function sectionsOf(dir: string): Section[] {
  return rustFiles(dir).flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    const tests = extractTests(source)
    if (tests.length === 0) return []
    return [{ path: relative(dir, file).split('\\').join('/'), description: moduleDoc(source), tests }]
  })
}

/** Test groups per crate under `crates/`: integration tests first, then unit tests in `src/`. */
export function collectGroups(root: string): Group[] {
  const cratesDir = join(root, 'crates')
  if (!existsSync(cratesDir)) return []
  return readdirSync(cratesDir)
    .sort()
    .flatMap((crate) =>
      (['tests', 'src'] as const).flatMap((kind) => {
        const sections = sectionsOf(join(cratesDir, crate, kind))
        if (sections.length === 0) return []
        const label = kind === 'tests' ? 'integration tests' : 'unit tests'
        return [{ heading: `${crate}: ${label} (crates/${crate}/${kind})`, sections }]
      }),
    )
}

export function renderCatalog(groups: Group[]): string {
  const total = groups.reduce((sum, g) => sum + g.sections.reduce((s, x) => s + x.tests.length, 0), 0)
  const out = [
    '# Test catalog',
    '',
    'Generated from the Rust test sources by `npm run test:catalog`; do not edit by hand. `npm run verify` fails when this file is out of date.',
    'What a topic covers is the `//!` comment at the top of its file; each test name reads as a sentence.',
    '',
    `Total: ${total} tests.`,
    '',
  ]
  for (const group of groups) {
    out.push(`## ${group.heading}`, '')
    for (const section of group.sections) {
      out.push(`### ${section.path} (${section.tests.length})`, section.description, '')
      for (const name of section.tests) out.push(`- ${humanize(name)}`)
      out.push('')
    }
  }
  return out.join('\n')
}

function main(args: string[]): number {
  const fresh = renderCatalog(collectGroups(ROOT))
  if (args.includes('--check')) {
    const current = existsSync(CATALOG_PATH) ? readFileSync(CATALOG_PATH, 'utf8') : ''
    if (current === fresh) return 0
    console.error('docs/foundation/test-catalog.md is out of date. Run: npm run test:catalog')
    return 1
  }
  writeFileSync(CATALOG_PATH, fresh)
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)))
