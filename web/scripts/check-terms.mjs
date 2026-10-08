// Fails when UI text or ux docs use a term that docs/GLOSSARY.md lists under "Do not use".
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

// Sources: string literals in tr.ts, and every ux doc outside the archive.
const sources = []
const tr = fs.readFileSync(path.join(root, 'web/src/i18n/tr.ts'), 'utf8')
tr.split('\n').forEach((l, i) => {
  const text = [...l.matchAll(/'([^']*)'/g)].map((m) => m[1]).join(' ')
  if (text) sources.push({ file: 'web/src/i18n/tr.ts', line: i + 1, text })
})
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name)
  if (d.isDirectory()) return d.name === 'arsiv' ? [] : walk(p)
  if (d.name === 'gelen-kutusu.md') return [] // raw words of the product owner
  return d.name.endsWith('.md') ? [p] : []
})
for (const f of walk(path.join(root, 'docs/ux'))) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((text, i) =>
    sources.push({ file: path.relative(root, f).replaceAll('\\', '/'), line: i + 1, text }))
}

let hits = 0
for (const s of sources) {
  let text = lower(s.text)
  for (const a of allowed) text = text.replaceAll(a, ' ')
  const found = [...new Set([...text.matchAll(pattern)].map((m) => m[1]))]
  if (found.length) { hits++; console.log(`${s.file}:${s.line}  ${found.join(', ')}`) }
}
console.log(hits ? `\n${hits} line(s) use terms banned in docs/GLOSSARY.md.` : 'Terms OK.')
process.exit(hits ? 1 : 0)
