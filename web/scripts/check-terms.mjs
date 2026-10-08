// Fails when UI text uses a term that docs/GLOSSARY.md lists under "Do not use".
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const glossary = fs.readFileSync(path.join(root, 'docs/GLOSSARY.md'), 'utf8')
const lower = (s) => s.toLocaleLowerCase('tr')
const ticks = (s) => [...s.matchAll(/`([^`]+)`/g)].map((m) => m[1])

// Banned word starts: backticked values in the "Do not use" column of every table.
const banned = new Set()
let col = -1
for (const line of glossary.split('\n')) {
  if (!line.startsWith('|')) { col = -1; continue }
  const cells = line.split('|').slice(1, -1).map((c) => c.trim())
  if (cells.includes('Do not use')) { col = cells.indexOf('Do not use'); continue }
  if (col >= 0 && cells[col]) ticks(cells[col]).forEach((t) => banned.add(lower(t)))
}
const allowed = ticks(glossary.match(/^Allowed phrases.*$/m)?.[0] ?? '').map(lower)

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const pattern = new RegExp(`(?<!\\p{L})(${[...banned].map(esc).join('|')})`, 'gu')

// Sources: string literals in tr.ts, outside the namespaces in SKIP. docs/ux is not checked.
const SKIP = new Set(['dashboard', 'entry', 'directory'])
const sources = []
const tr = fs.readFileSync(path.join(root, 'web/src/i18n/tr.ts'), 'utf8')
let ns = ''
tr.split('\n').forEach((l, i) => {
  ns = l.match(/^ {2}(\w+): \{/)?.[1] ?? ns
  if (SKIP.has(ns)) return
  const text = [...l.matchAll(/'([^']*)'/g)].map((m) => m[1]).join(' ')
  if (text) sources.push({ file: 'web/src/i18n/tr.ts', line: i + 1, text })
})

let hits = 0
for (const s of sources) {
  let text = lower(s.text)
  for (const a of allowed) text = text.replaceAll(a, ' ')
  const found = [...new Set([...text.matchAll(pattern)].map((m) => m[1]))]
  if (found.length) { hits++; console.log(`${s.file}:${s.line}  ${found.join(', ')}`) }
}
console.log(hits ? `\n${hits} line(s) use terms banned in docs/GLOSSARY.md.` : 'Terms OK.')
process.exit(hits ? 1 : 0)
