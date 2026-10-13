---
owner: backend-engineer
status: active
---

# Local-first architecture

Technical design of the local app. Product model: [ARCHITECTURE](../../ARCHITECTURE.md). Plan: [ROADMAP](../../ROADMAP.md). Topics: [database](../database/rules.md), [API](../api/operations.md), [runtime](../runtime/backup.md).

## Goals
- Local first: all data in one SQLite file on the user's device. No server. A 6-digit PIN per member gates the app (not encryption; see [PIN gate](../../pin-gate.md)).
- Low RAM and CPU. Fast start. No network wait.
- Simple. Build the core components in v1. Add the rest over time.
- Sync, mobile and plugins come later. Do not build them in v1.

## Stack
Technology list: [stack](stack.md).
- Shell: Tauri 2, desktop only.
- Code: TypeScript. UI: React with ReUI on shadcn, only the parts the app uses.
- Data: SQLite (WAL mode). No ORM, no query builder. Plain SQL files. No DuckDB.
- Layout: one project. `src/core/` holds pure TypeScript (rules, services, SQL, tests). `src/ui/` holds pages and components. `core` never imports UI or Tauri code (lint rule).
- Rust stays thin (`src-tauri/src/db.rs`, about 100 lines, rusqlite bundled): open the database, `db_query(sql, params)`, `db_batch([{sql, params}])` in one transaction. `db_query` returns `{columns, rows}` with rows as arrays. File work is in `src-tauri/src/backup.rs` (see [Backup and export](../runtime/backup.md)).
- Core gets the database through the `Db` interface (`src/core/db.ts`). The app uses Rust over IPC (`src/ui/tauri-db.ts`). Tests use `node:sqlite` (`src/core/test/node-db.ts`). Node is a dev tool only; the app does not ship it.
- Dev in a plain browser (Playwright): the Vite plugin `scripts/dev-db.ts` serves the `node:sqlite` Db at `/__db`, and `src/ui/dev-db.ts` calls it. The UI uses it only in Vite dev outside Tauri. File: `AA_DEV_DB`, default `.dev/aa-finance.sqlite` (delete it to start again). `npm run seed` writes a fresh book with three months of entries (stop Vite first).
- UI: `src/ui/` (alias `@`). Data through `src/ui/lib/api.ts` (`useOp` reads, `useWrite` writes and refetches all), TanStack Query, `HashRouter`. i18n in `src/ui/i18n/`; API error codes map to `errors.<code>`.
- Migrations: `src/core/migrations/NNNN_name.sql`, applied by `migrate()` after `PRAGMA user_version`, one transaction each.

## PIN gate and session
- The file is **not encrypted**. Anyone who can read it can read every entry and can delete the PIN rows with any SQLite tool. The PIN stops a visitor or family member who uses the open app, nothing more. 6 digits are 1,000,000 values, so the stored hash is brute-forceable offline. Real protection is OS accounts and disk encryption.
- `createApi(db, {now?})` takes no actor. The session lives in memory inside the API: `members.signIn` (a good PIN) or `setup.run` binds the member; `api.lock()` clears it. A reload or restart locks.
- Locked, only `setup.run`, `currencies.list`, `members.list`, `settings.groupName`, `members.signIn`, `members.setPin` run. Everything else fails with `locked` (`not_setup` before setup).
- PIN: PBKDF2-SHA256 (WebCrypto, `src/core/pin.ts`), random salt, 200,000 iterations kept per row. Table `member_pins`: [tables](../database/tables.md).
- Wrong tries: 5 wrong tries set a 30 s wait (`pin_wait` with `seconds`, the PIN is not checked meanwhile). The counter commits in its own batch, so the failed call cannot roll it back. It lives in the file, so a restart keeps it; a changed clock bypasses it (accepted). After the wait, 5 more tries. A good PIN clears it. Idle timing (5 minutes) is a UI constant, not core.
- Lone admin who forgets the PIN: no recovery in the app. A backup restore brings back that backup's PIN.

## Plugins (later, v1.x)
- A plugin is a folder: `manifest.json` and `main.js`. It runs in the app with full trust, like Obsidian. The user carries the risk.
- Restricted mode is on by default and runs no plugin. The user turns it off after a clear warning.
- A plugin writes with its own `actor`. The database rules still hold if it skips the API.
- Plugin loading needs a Tauri CSP change. Solve it in that phase.

## Out of v1
Sync, per-member entry grants, mobile, plugins, server-side rates, tags, dashboard. Rates are manual. Backup and export of all data (SQLite file, JSON) are in v1.

## Open
- Encrypt the file at rest (SQLCipher): decide before release.
- Sync design: decide when sync starts.
