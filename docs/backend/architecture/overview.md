---
owner: backend-engineer
status: active
---

# Local-first architecture

Technical design of the local app. Product model: [ARCHITECTURE](../../ARCHITECTURE.md). Plan: [ROADMAP](../../ROADMAP.md). Topics: [database](../database/rules.md), [API](../api/operations.md), [runtime](../runtime/backup.md).

## Goals
- Local first: all data in one SQLite file on the user's device. No server, no sign-in.
- Low RAM and CPU. Fast start. No network wait.
- Simple. Build the core components in v1. Add the rest over time.
- Sync, mobile and plugins come later. Do not build them in v1.

## Stack
- Shell: Tauri 2, desktop only.
- Code: TypeScript. UI: React with ReUI on shadcn, only the parts the app uses.
- Data: SQLite (WAL mode). No ORM, no query builder. Plain SQL files. No DuckDB.
- Layout: one project. `src/core/` holds pure TypeScript (rules, services, SQL, tests). `src/ui/` holds pages and components. `core` never imports UI or Tauri code (lint rule).
- Rust stays thin (`src-tauri/src/db.rs`, about 100 lines, rusqlite bundled): open the database, `db_query(sql, params)`, `db_batch([{sql, params}])` in one transaction. `db_query` returns `{columns, rows}` with rows as arrays. File work is in `src-tauri/src/backup.rs` (see [Backup and export](../runtime/backup.md)).
- Core gets the database through the `Db` interface (`src/core/db.ts`). The app uses Rust over IPC (`src/ui/tauri-db.ts`). Tests use `node:sqlite` (`src/core/test/node-db.ts`). Node is a dev tool only; the app does not ship it.
- Dev in a plain browser (Playwright): the Vite plugin `scripts/dev-db.ts` serves the `node:sqlite` Db at `/__db`, and `src/ui/dev-db.ts` calls it. The UI uses it only in Vite dev outside Tauri. File: `AA_DEV_DB`, default `.dev/aa-finance.sqlite` (delete it to start again). `npm run seed` writes a fresh book with three months of entries (stop Vite first).
- UI: `src/ui/` (alias `@`). Data through `src/ui/lib/api.ts` (`useOp` reads, `useWrite` writes and refetches all), TanStack Query, `HashRouter`. i18n in `src/ui/i18n/`; API error codes map to `errors.<code>`.
- Migrations: `src/core/migrations/NNNN_name.sql`, applied by `migrate()` after `PRAGMA user_version`, one transaction each.

## Plugins (later, v1.x)
- A plugin is a folder: `manifest.json` and `main.js`. It runs in the app with full trust, like Obsidian. The user carries the risk.
- Restricted mode is on by default and runs no plugin. The user turns it off after a clear warning.
- A plugin writes with its own `actor`. The database rules still hold if it skips the API.
- Plugin loading needs a Tauri CSP change. Solve it in that phase.

## Out of v1
Sync, PIN or sign-in, per-member entry grants, mobile, plugins, server-side rates, tags, dashboard. Rates are manual. Backup and export of all data (SQLite file, JSON) are in v1.

## Open
- Encrypt the file at rest (SQLCipher): decide before release.
- Sync design: decide when sync starts.
