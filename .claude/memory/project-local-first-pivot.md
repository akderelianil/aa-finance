---
name: project-local-first-pivot
description: 2026-10-12 architecture: fully local Tauri + SQLite + TS core on branch local-first; DB-enforced rules, API-first, trusted plugins later; keep it simple
metadata:
  node_type: memory
  type: project
  originSessionId: 65aee460-9522-404c-8783-aca9f19cf8c3
  modified: 2026-10-12T12:43:16.870Z
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
- L0 spike done 2026-10-12: rusqlite bundled, tests on `node:sqlite` (Node is dev-only; the user first thought Node would ship, so say "dev tool only" when it comes up). The user decided money is a plain safe-integer `number`, not bigint ("bu kadar büyük sayılar olmayacak"). Idle RAM ~245–360 MB on WSL vs the 150 MB budget: the user accepts it, optimize later; do not block phases on it.
- L1 schema done 2026-10-12 (0001_schema.sql, chart.ts, setup.ts, schema.test.ts). User decisions: drafts are transient only (inside one batch); full ISO currency list, fixed; system account names translated by the UI from system_key; template = core + optional recommended. For perf tests use ~10k entries, not 1M ("1M kayıt çok uzun sürüyor").
- L2 Core API done 2026-10-12 (`src/core/api/`, `money.ts`, `quick.ts`). User decisions: zod/mini for input schemas; API names records by uid; FX rounding difference goes to FX Gains and Losses only up to 1 minor unit per converted line (user first chose "always"; accepted the limit after the hidden-typo risk was shown); Quick Entry flows are pure builders in core.
- L3 UI done 2026-10-12 in 7 commits (L3a–L3g). User decisions: reuse ReUI parts from `web/`, rewrite pages; Vite dev bridge (`scripts/dev-db.ts`, `/__db`) for Playwright, `npm run seed` for demo data; react-router HashRouter; TanStack Query (`useOp`/`useWrite`, any write refetches all); Settings, Rates and entry history (audit) in L3. Borç person = child account under receivables/payables, a new name opens the account on save. Journal "Yeni kayıt" = free entry; Quick Entry from the sidebar.
- Use ponytail style for code: clean, simple, logical hierarchy. Discuss before writing plans; the user decides step by step. See [[feedback-working-style]], [[project-ledger-core-pivot]].
