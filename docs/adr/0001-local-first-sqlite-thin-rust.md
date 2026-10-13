# ADR-0001: Local-first: SQLite behind a thin Rust shell

**Date**: 2026-10-13 (recorded from the code; the Supabase version was retired earlier, tag `supabase-final`)
**Status**: superseded in part by [ADR-0008](0008-shared-rust-core.md) (core language) and [ADR-0009](0009-chromium-shell-react-ui.md) (shell); local-first SQLite stays
**Deciders**: product owner

## Context
The app is a private family ledger on one device. The first version used Supabase (a server). Users want privacy, no network wait, low RAM and an easy backup. Accounting rules must hold no matter which UI calls the data.

## Decision
All data lives in one SQLite file (WAL). Tauri 2 is the desktop shell. Rust stays thin: `db_query` and `db_batch` (one transaction) plus backup. All rules, SQL and named API operations are pure TypeScript in `src/core/`, which gets the database through the `Db` interface. The UI calls only named operations, never SQL.

## Alternatives Considered
### Server database (Supabase / Postgres)
- **Pros**: sync, multi-device.
- **Cons**: account setup, network, privacy, running cost.
- **Why not**: sync is out of scope; the retired version proved the extra weight.

### Business logic in Rust
- **Pros**: one language near the database.
- **Cons**: slower iteration, tests need the Tauri runtime.
- **Why not**: pure TypeScript runs in `node --test` against `node:sqlite` in milliseconds.

### ORM or query builder
- **Pros**: less SQL by hand.
- **Cons**: hides triggers and error codes, adds weight.
- **Why not**: plain SQL files make the rules readable and migratable.

## Consequences
### Positive
- Fast tests (the whole suite runs in seconds), no server, one file to back up.
- `core` never imports UI or Tauri code, so it is portable.

### Negative
- No sync or multi-device without a new design.
- Two adapters (`tauri-db.ts`, `node-db.ts`) must behave the same.

### Risks
- The file is not encrypted at rest (see [ADR-0003](0003-pin-is-an-app-gate.md)). Decision on SQLCipher is open before release.
