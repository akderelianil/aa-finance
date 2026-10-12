import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { invoke } from '@tauri-apps/api/core'
import { migrate } from '../core/migrate.ts'
import { migrations, tauriDb as db } from './tauri-db.ts'

// L0 spike page: opens the database, runs migrations and measures IPC cost.
// L3 replaces it with the real UI.

async function time(label: string, out: string[], fn: () => Promise<unknown>) {
  const t = performance.now()
  await fn()
  out.push(`${label}: ${(performance.now() - t).toFixed(1)} ms`)
}

async function bench(): Promise<string[]> {
  const out: string[] = []
  await db.batch([{ sql: 'DELETE FROM spike' }])
  await time('1000 × SELECT 1 (sequential IPC)', out, async () => {
    for (let i = 0; i < 1000; i++) await db.query('SELECT 1')
  })
  const rows = Array.from({ length: 100_000 }, (_, i) => ({
    sql: 'INSERT INTO spike (amount, note) VALUES (?, ?)',
    params: [i * 1234 - 50_000_000, `note ${i}`],
  }))
  await time('batch insert 100k rows (one IPC call)', out, () => db.batch(rows))
  await time('query 1k rows', out, () => db.query('SELECT * FROM spike LIMIT 1000'))
  await time('query 10k rows', out, () => db.query('SELECT * FROM spike LIMIT 10000'))
  await time('query 100k rows', out, () => db.query('SELECT * FROM spike'))
  await time('SUM over 100k rows', out, () => db.query('SELECT sum(amount) AS s FROM spike'))

  const max = Number.MAX_SAFE_INTEGER
  const [r] = await db.query('SELECT ? AS a, ? AS b', [max, -max])
  out.push(`safe integers round-trip: ${r.a === max && r.b === -max}`)
  const err = await db.query('SELECT ? + 1 AS a', [max]).then(
    () => 'no error (WRONG)',
    (e) => `error: ${e}`,
  )
  out.push(`above 2^53: ${err}`)
  const rollback = await db
    .batch([
      { sql: 'INSERT INTO spike (amount) VALUES (?)', params: [1] },
      { sql: 'INSERT INTO spike (amount) VALUES (?)', params: [null] },
    ])
    .then(() => 'committed (WRONG)', async () => {
      const [{ n }] = await db.query('SELECT count(*) AS n FROM spike')
      return n === 100_000 ? 'rolled back' : `partial write (WRONG, ${n} rows)`
    })
  out.push(`failed batch: ${rollback}`)
  return out
}

// Once, outside React: StrictMode runs effects twice in dev.
const ready = migrate(db, migrations).then(
  (v) => `ready at ${performance.now().toFixed(0)} ms after page start, schema v${v}`,
)

function App() {
  const [lines, setLines] = useState<string[]>(['opening…'])
  const show = (out: string[]) => {
    setLines(out)
    invoke('dev_log', { msg: out.join('\n') })
  }
  const fail = (e: unknown) => show([`error: ${e}`])
  useEffect(() => {
    ready.then((l) => show([l]), fail)
  }, [])
  return (
    <main style={{ font: '13px ui-monospace, monospace', padding: 16 }}>
      <button onClick={() => (setLines(['running…']), bench().then(show, fail))}>Run benchmark</button>
      <pre>{lines.join('\n')}</pre>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
