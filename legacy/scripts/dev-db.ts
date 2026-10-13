// Dev only: a Vite plugin that serves the node:sqlite Db over HTTP, so the UI runs in a plain browser
// (Playwright, no Tauri). The app build never includes it. File: AA_DEV_DB, default .dev/aa-finance.sqlite.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Plugin } from 'vite'
import { openNodeDb, readMigrations } from '../src/core/test/node-db.ts'

export function devDb(): Plugin {
  return {
    name: 'aa-dev-db',
    apply: 'serve',
    configureServer(server) {
      const path = process.env.AA_DEV_DB ?? '.dev/aa-finance.sqlite'
      if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
      let db = openNodeDb(path)
      server.middlewares.use('/__db', (req, res) => {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          try {
            const { op, sql, params, statements, file } = JSON.parse(body)
            if (op === 'backup' || op === 'restore') {
              // Like backup_to / restore_from in src-tauri/src/backup.rs: a VACUUM INTO copy, and a checked replace.
              const tmp = mkdtempSync(join(tmpdir(), 'aa-dev-'))
              try {
                if (op === 'backup') {
                  const copy = join(tmp, 'backup.sqlite')
                  await db.query('VACUUM INTO ?', [copy])
                  res.setHeader('content-type', 'application/octet-stream')
                  res.end(readFileSync(copy))
                  return
                }
                const upload = join(tmp, 'upload.sqlite')
                writeFileSync(upload, Buffer.from(file, 'base64'))
                const src = new DatabaseSync(upload, { readOnly: true })
                try {
                  const one = (q: string) => Object.values(src.prepare(q).get() ?? {})[0]
                  if (one('PRAGMA quick_check') !== 'ok'
                    || one("SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name IN ('settings', 'entries', 'lines')") !== 3)
                    throw new Error('not_a_backup')
                  if (Number(one('PRAGMA user_version')) > readMigrations().length) throw new Error('backup_too_new')
                } catch (e) {
                  throw e instanceof Error && /^(not_a_backup|backup_too_new)$/.test(e.message) ? e : new Error('not_a_backup')
                } finally {
                  src.close()
                }
                if (path !== ':memory:') {
                  const before = join(dirname(path), 'backups')
                  mkdirSync(before, { recursive: true })
                  await db.query('VACUUM INTO ?', [join(before, `before-restore-${Date.now()}.sqlite`)])
                }
                db.close()
                for (const ext of ['-wal', '-shm']) rmSync(path + ext, { force: true })
                writeFileSync(path, readFileSync(upload))
                db = openNodeDb(path)
                res.setHeader('content-type', 'application/json')
                res.end('null')
              } finally {
                rmSync(tmp, { recursive: true, force: true })
              }
              return
            }
            if (op === 'reset') {
              // Like wipe() in src-tauri/src/backup.rs: drop every trigger, view and table, user_version 0.
              const names = await db.query(
                `SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type IN ('trigger', 'view', 'table')
                 ORDER BY CASE type WHEN 'trigger' THEN 0 WHEN 'view' THEN 1 ELSE 2 END`)
              await db.query('PRAGMA foreign_keys = OFF')
              try {
                await db.batch([
                  ...names.map((n) => ({ sql: `DROP ${String(n.type).toUpperCase()} "${String(n.name).replaceAll('"', '""')}"` })),
                  { sql: 'PRAGMA user_version = 0' },
                ])
              } finally {
                await db.query('PRAGMA foreign_keys = ON')
              }
              res.setHeader('content-type', 'application/json')
              res.end('null')
              return
            }
            const out = op === 'batch' ? await db.batch(statements) : await db.query(sql, params)
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(out ?? null))
          } catch (e) {
            res.statusCode = 500
            res.end(e instanceof Error ? e.message : String(e))
          }
        })
      })
    },
  }
}
