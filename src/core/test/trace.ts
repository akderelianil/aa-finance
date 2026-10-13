// Test titles that exist in the repo, and the test titles a Markdown trace file names. Docs-check support only.
import { readdirSync, readFileSync } from 'node:fs'

const ROOTS = ['src', 'scripts'].map((dir) => new URL(`../../../${dir}/`, import.meta.url))

function* testFiles(dir: URL): Generator<URL> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const next = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
    if (entry.isDirectory()) yield* testFiles(next)
    else if (entry.name.endsWith('.test.ts')) yield next
  }
}

/** Every `test('title', ...)` title in the repo. */
export function allTestTitles(): Set<string> {
  const titles = new Set<string>()
  for (const root of ROOTS)
    for (const file of testFiles(root))
      for (const m of readFileSync(file, 'utf8').matchAll(/\btest\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) titles.add(m[2].replace(/\\(['"`])/g, '$1'))
  return titles
}

/** Test titles named in a trace file as `test: <title>` cells or lines (backticks around the title are optional). */
export function namedTests(markdown: string): string[] {
  const out: string[] = []
  for (const m of markdown.matchAll(/`?test:\s*([^|\n`]+?)`?\s*(?:\||$)/gm)) {
    const title = m[1].trim()
    if (title && title !== 'NONE') out.push(title)
  }
  return out
}
