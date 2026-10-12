---
name: project-local-first-pivot
description: 2026-10-12 architecture: fully local Tauri + SQLite + TS core on branch local-first; DB-enforced rules, API-first, trusted plugins later; keep it simple
metadata:
  node_type: memory
  type: project
  originSessionId: 65aee460-9522-404c-8783-aca9f19cf8c3
  modified: 2026-10-12T12:17:03.619Z
---

Decided with the product owner on 2026-10-12 (branch `local-first`, written in docs/LOCAL-FIRST.md; phases L0–L4 in ROADMAP). Fully local desktop app: Tauri 2, one SQLite file, TypeScript, ReUI/shadcn. No server, no sign-in. Sync, mobile and plugins come later. Rewrite from scratch; the old `supabase/` and `web/` stay until parity.

**Why:** trust through local data, fast start, low RAM/CPU for the user. Simplicity first.

**How to apply:**
- Keep it simple. No ORM, no query builder, plain SQL files. No DuckDB. Go and PocketBase are dropped for good: do not suggest them.
- One project: `src/core/` (pure TS, never imports UI/Tauri) and `src/ui/`. Thin Rust: `db_query`, `db_batch` (one transaction). Confirm in the L0 spike.
- DB enforces the rules (triggers): balance via entry `draft`/`posted`, no hard delete, locks, currency match, logs immutable. The service only pre-checks for clear messages.
- Every table: `id INTEGER` + `uid` UUIDv7 + created/updated at/by (→ `actors`). Signed amounts (+debit, −credit). Multi-currency is core: base currency chosen at setup, fixed; rates manual. Entry number per year (assigned on first post, never reused) plus free `reference`.
- Two logs: `audit_log` (triggers, who changed a row) and `activity_log` (API, who did what).
- API first: UI calls only named JSON operations. Plugins (v1.x) are trusted in-process like Obsidian, restricted mode on by default with a warning; user carries the risk.
- Grids: SQL paging + ReUI data-grid (`manualPagination`); virtualization later if needed. Use only the parts the app needs.
- L0 spike done 2026-10-12: rusqlite bundled, tests on `node:sqlite` (Node is dev-only; the user first thought Node would ship, so say "dev tool only" when it comes up). The user decided money is a plain safe-integer `number`, not bigint ("bu kadar büyük sayılar olmayacak"). Open: idle RAM ~245–360 MB on WSL vs 150 MB budget; re-measure on Windows.
- Use ponytail style for code: clean, simple, logical hierarchy. Discuss before writing plans; the user decides step by step. See [[feedback-working-style]], [[project-ledger-core-pivot]].
