// Dev only: a Vite plugin that serves the node:sqlite Db over HTTP, so the UI runs in a plain browser
// (Playwright, no Tauri). The app build never includes it. File: AA_DEV_DB, default .dev/aa-finance.sqlite.
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Plugin } from 'vite'
import { openNodeDb } from '../src/core/test/node-db.ts'

export function devDb(): Plugin {
  return {
    name: 'aa-dev-db',
    apply: 'serve',
    configureServer(server) {
      const path = process.env.AA_DEV_DB ?? '.dev/aa-finance.sqlite'
      if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
      const db = openNodeDb(path)
      server.middlewares.use('/__db', (req, res) => {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
          try {
            const { op, sql, params, statements } = JSON.parse(body)
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
