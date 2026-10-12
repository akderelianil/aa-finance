---
owner: main
status: active
---

# Local-first architecture

Decided 2026-10-12 with the product owner, on branch `local-first`. It replaces the Supabase backend. Phases are in [ROADMAP](ROADMAP.md).

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
- Rust stays thin (`src-tauri/src/db.rs`, about 100 lines, rusqlite bundled): open the database, `db_query(sql, params)`, `db_batch([{sql, params}])` in one transaction. `db_query` returns `{columns, rows}` with rows as arrays.
- Core gets the database through the `Db` interface (`src/core/db.ts`). The app uses Rust over IPC (`src/ui/tauri-db.ts`). Tests use `node:sqlite` (`src/core/test/node-db.ts`). Node is a dev tool only; the app does not ship it.
- Migrations: `src/core/migrations/NNNN_name.sql`, applied by `migrate()` after `PRAGMA user_version`, one transaction each.

## Database rules
The database enforces the rules. The TypeScript service checks first, only to give clear messages.

- Schema: `src/core/migrations/0001_schema.sql`. All tables are `STRICT` (a float in a money column fails). A broken rule raises a stable error code (`entry_unbalanced`, `period_locked`, ...); the API maps codes to messages.
- Every data table has `id INTEGER PRIMARY KEY` (joins and queries), `uid TEXT UNIQUE` (UUIDv7 from `src/core/uuid.ts`, for export and later sharing), `created_at`, `updated_at` (unix ms), `created_by`, `updated_by` (→ `actors`). Core makes the `uid`, so one batch can refer to a row it just wrote (`(SELECT id FROM entries WHERE uid = ?)`). `currencies` is fixed reference data (ISO 4217, `0002_currencies.sql`) without these columns. Actor 1 is `system`.
- The API sets `updated_at` and `updated_by` on every update. A trigger cannot do it without logging each update twice.
- Rows are never deleted. `deleted_at` marks a soft delete. A trigger blocks `DELETE`.
- Money is integer minor units, a plain `number` in TypeScript (never float math). Integers cross IPC as JSON numbers. Both adapters reject a value outside ±(2^53−1); amounts never get that large. Rates are text. Dates are `TEXT 'YYYY-MM-DD'`.
- Balances are not stored. They come from lines.
- Entry state is `draft` or `posted`. A draft exists only inside one batch while an entry is written or edited (decided 2026-10-12); every batch ends with `posted`. So balance queries read only `lines`. A trigger checks "≥2 live lines and `SUM(base_amount) = 0`" when the state becomes `posted`. Lines are written only while the entry is a draft. An edit sets `draft`, changes lines (a removed line gets `deleted_at`), sets `posted` again, in one batch. A posted entry can change its description and reference, not its date.
- A soft-deleted entry takes its lines with it (trigger). A soft-deleted row is final.
- Line amounts are nonzero and `amount` and `base_amount` have the same sign. On a base-currency account `base_amount = amount` and `rate` is null; on any other account `rate` is required.
- Other triggers: no line on a placeholder, archived or deleted account; an account with live lines keeps its currency and cannot become a placeholder or be deleted; locked accounts do not change; type, `locked` and `system_key` never change; parent has the same type and no cycle; base currency is set once; no change on or before `lock_date`; write `audit_log`; block changes to both logs (`activity_log` rows can be deleted after `activity_log_days`).
- Entry number: `entries.year` and `entries.number`, unique per year. A trigger assigns the next number when the entry is first posted. The number never changes and is never reused. `entries.reference` is a free text document number (invoice, cheque).
- `lines.entry_date` copies the entry date (a trigger checks it and keeps it in sync). The partial covering index `lines(account_id, entry_date, amount, base_amount, deleted_at) WHERE deleted_at IS NULL` serves balances and registers. Keep `deleted_at` in it, or SQLite reads the table for every row.
- Numbering uses `ORDER BY number DESC LIMIT 1` on the partial index. `max(number)` with a `WHERE` scans the year and made posting quadratic.

## Tables (v1)
| Table | Columns (besides common) |
|---|---|
| `actors` | `kind` (user, plugin, system), `name` |
| `settings` | `key`, `value` (base currency, `lock_date`, language) |
| `currencies` | `code`, `name`, `minor_unit` |
| `fx_rates` | `date`, `currency_id`, `rate` (manual entry) |
| `accounts` | `parent_id`, `name`, `type`, `currency_id`, `code`, `is_placeholder`, `locked`, `system_key`, `archived_at` |
| `entries` | `entry_date`, `year`, `number`, `reference`, `description`, `state` |
| `lines` | `entry_id`, `account_id`, `entry_date`, `amount`, `base_amount`, `rate`, `memo`, `position` |
| `audit_log` | `table_name`, `row_id`, `op`, `old`, `new` (JSON), `actor_id`, `at` |
| `activity_log` | `actor_id`, `operation`, `summary`, `ok`, `error_code`, `duration_ms`, `at` |

- Amounts are signed: plus is debit, minus is credit. The UI shows Borç and Alacak from the sign.
- Base currency is chosen at setup and never changes. Every account has a currency. A line holds `amount` (account currency) and `base_amount` (base currency).
- Chart: types asset, liability, equity, income, expense. Template: `src/core/chart.ts`, applied by `setup()` (`src/core/setup.ts`) in the base currency. Core accounts are locked and have a `system_key` (5 roots, cash, bank, investments, fixed assets, receivables, credit cards, loans, payables, opening balance, FX gains and losses, bank fees); the UI shows their names from i18n by key, `name` is an English fallback. The Wallet starter is always added; the recommended income and expense accounts are an option at setup, named in the setup language. Investment gains/losses is not in v1. The UI hides codes.
- Logs: `audit_log` (triggers, kept forever) answers "who changed this row". `activity_log` (written by the API, pruned by a setting) answers "who did what".
- Later: contacts, tags, dashboard, plugin data.

## API first
- The UI calls only the API, never SQL. The API is named JSON operations (`accounts.create`, `entries.post`, `reports.trialBalance`). Each has an input schema, an output schema, error codes and a version.
- The API does not depend on a transport. v1 uses direct calls in the WebView. Later: plugins and an optional local HTTP or CLI bridge.
- The API runs in the WebView, so outside access needs the app to be open.

## Plugins (later, v1.x)
- A plugin is a folder: `manifest.json` and `main.js`. It runs in the app with full trust, like Obsidian. The user carries the risk.
- Restricted mode is on by default and runs no plugin. The user turns it off after a clear warning.
- A plugin writes with its own `actor`. The database rules still hold if it skips the API.
- Plugin loading needs a Tauri CSP change. Solve it in that phase.

## Budgets (check each phase)
- Cold start under 1 s. Idle RAM under 150 MB. First bundle under 500 KB compressed.
- Reports on 1M synthetic lines under 200 ms.
- Grids use SQL paging (ReUI `data-grid` with `manualPagination`). Virtualization (`DataGridTableVirtual`) comes later if needed.

### Measured (L0, release build, WSL2 + WSLg, no GPU)
| Check | Result |
|---|---|
| Process start → database open and migrated | 440–480 ms |
| One IPC round trip (`SELECT 1`) | 0.4 ms |
| Insert 100k rows in one `db_batch` | 300 ms |
| Read 1k / 10k / 100k rows | 31 / 8 / 65 ms |
| `SUM` over 100k rows | 5 ms |
| Binary / first bundle (gzip) | 4.7 MB / 69 KB |
| Idle memory, PSS (app + WebKit processes) | 360 MB; 245 MB with `WEBKIT_DISABLE_COMPOSITING_MODE=1` |

- Idle memory misses the 150 MB budget on WSL. Most of it is WebKitGTK with software rendering. The product owner accepts it for now. Optimize memory after v1 works.
- Keep IPC calls few: one call per operation, not one per row.

### Measured (L1, node:sqlite, all triggers on)
| Check | Result |
|---|---|
| Write and post 10k entries (20k lines, audit rows) | 1.8 s, linear |
| Trial balance / one account balance / one-year totals | 3 / 0 / 2 ms |

## Out of v1
Sync, groups and members, mobile, plugins, server-side rates, contacts, tags, dashboard. Rates are manual. Backup and export of all data (SQLite file, JSON) are in v1.

## Open
- Encrypt the file at rest (SQLCipher): decide before release.
- Sync design: decide when sync starts.
