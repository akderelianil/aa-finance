---
owner: backend-engineer
status: active
---

# Database rules

The database enforces the rules. Tables: [tables](tables.md). Model: [ledger-model](ledger-model.md).

- Schema: `src/core/migrations/` (`0001_schema.sql` first; `0005`–`0007` rebuilt the data tables: no `uid`, no `accounts.code`, uniform audit columns; `0008` adds the Rehber tables, `0009` adds `lines.contact_id`). All tables are `STRICT` (a float in a money column fails). A broken rule raises a stable error code (`entry_unbalanced`, `period_locked`, ...); the API maps codes to messages.
- Every table except the two logs has `id INTEGER PRIMARY KEY` and the same six audit columns: `created_at`, `updated_at` (unix ms), `created_by`, `updated_by`, `deleted_at`, `deleted_by` (→ `actors`; `deleted_*` are both set or both null). `currencies` too (ISO 4217, `0002_currencies.sql`; owned by System). Settings and currencies are never deleted: a trigger blocks it. There is no global id: one file is one ledger. If sharing or sync comes, add a `uid` with a migration. `entries.post` takes the next id (`max(id)+1`; rows are never deleted) so one batch can refer to the entry it just wrote. Actor 1 is `system`.
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
