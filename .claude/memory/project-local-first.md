---
name: project-local-first
description: aa-finance is a local Tauri + SQLite + TS app (Supabase retired to archive/); product rules, owner decisions and X1 status as of 2026-10-12 (schema 0008)
metadata:
  type: project
---

The Supabase version (`web/`, `supabase/`) is retired to `archive/` (tag `supabase-final`). The app is Tauri 2 + one SQLite file + TypeScript core + ReUI. Design: `docs/backend/local-first.md`, `docs/ARCHITECTURE.md`; plan: `docs/ROADMAP.md`.

Owner decisions that the docs do not explain:
- Audience: professional personal-finance users who know accounting. Judge every feature against the ledger core. No Num or reconcile now.
- Keep it simple: no ORM, no query builder, no DuckDB; Go and PocketBase are dropped for good. Node is a dev tool only. Money is a plain safe-integer `number`.
- One ledger file = one family, many members, no PIN (a PIN without encryption is not security). Book settings admin only. Country sets date and number format.
- Performance tests use 10k entries, not 1M. Idle RAM 245–360 MB on WSL is accepted. Slow grids came from skeleton rows, not the DB: profile the client first.
- `audit_log` stays in the SQLite file; per-member view, export and hash chain are a future plan (ROADMAP Later).
- Schema (0001–0008): no `uid` (rows are named by integer `id`), no `accounts.code`; every table but the logs has the six audit columns ([audit columns](feedback-audit-columns-everywhere.md)); `entries.state` stays ([why](project-entries-state-kept.md)). Rehber tables `contacts` + `brand_businesses` (brand ↔ business many-to-many) exist with API ops; the Rehber page and the link from entry lines are deferred by the owner (write `docs/ux/rehber.md` first). setup, members, roles, format done. Next: entry flow (Hızlı Kayıt). Start by asking the owner to narrate how they use it today, then critique and options. Not yet clicked in the real Tauri app.

**Why:** local data builds trust; the value now comes from clear flows.
**How to apply:** follow [feedback-ux-focus](feedback-ux-focus.md) and [feedback-working-style](feedback-working-style.md). Use ponytail style for code.
