# Spec: audit-and-logs

> Auto-extracted by spec-miner. Last mined: 2026-10-13.
> Source: src/core/api/index.ts, src/core/api/logs.ts, src/core/api/errors.ts, src/core/migrate.ts, src/core/db.ts, src/core/migrations/0001_schema.sql, 0005_drop_uid.sql, 0007_audit_columns.sql, 0008_contacts.sql, 0010_account_owner.sql, 0011_line_member.sql
> Last verified: 2026-10-13 (commit 9bc514c)

Scope: soft delete only, the `audit_log` triggers (who changed a row), the `activity_log` written by the API (who did what), pruning, audit columns, the API call envelope (input check, error codes, clock) and migrations. Each block lists `id`, `entities`, `enforced` (file:line) and the exact title of the covering test (`NONE` when no test covers it).

---

### Invariant: No hard delete
- id: AUDIT-001
- entities: Currency, Actor, Setting, FxRate, Account, Entry, Line, Contact, BrandBusiness, MemberPin, AuditLog, ActivityLog
- enforced: `*_no_delete` triggers src/core/migrations/0007_audit_columns.sql:234-242, 423-425; 0008_contacts.sql:40-41; 0012_member_pins.sql:26; `audit_log_no_delete` 0005_drop_uid.sql:204; `activity_log_prune` 0005_drop_uid.sql:212-218 (`no_delete`, `log_immutable`)
- test: no table allows DELETE

A DELETE SHALL fail on every table; rows leave only by soft delete, except `activity_log` rows past their retention.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Requirement: audit_log records every row change
- id: AUDIT-002
- entities: AuditLog
- enforced: `*_audit_insert`/`*_audit_update` triggers: actors, settings, fx_rates, entries src/core/migrations/0007_audit_columns.sql:446-722; accounts 0010_account_owner.sql:29-90; lines 0011_line_member.sql:20-85; contacts, brand_businesses 0008_contacts.sql:105-195
- test: audit_log records every write with its actor and cannot change

Every insert, update and soft delete on actors, settings, fx_rates, accounts, entries, lines, contacts and brand_businesses SHALL add an `audit_log` row with op `insert`, `update` or `delete`, old and new row JSON, and the row's `updated_by` as actor.

#### Scenario: Post then delete an entry
- **WHEN** an entry is inserted, posted and soft deleted
- **THEN** its audit rows are insert, update, update (number) and delete, and both lines get a delete row

---

### Invariant: audit_log is immutable
- id: AUDIT-003
- entities: AuditLog
- enforced: triggers `audit_log_no_update`/`audit_log_no_delete` src/core/migrations/0005_drop_uid.sql:204, 208 (`log_immutable`)
- test: audit_log records every write with its actor and cannot change

`audit_log` rows SHALL never be updated or deleted.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Requirement: Successful writes are logged with the change
- id: AUDIT-004
- entities: ActivityLog
- enforced: `ctx.write` src/core/api/index.ts:124-131
- test: activity_log records writes and failures; audit.forRow shows row history

Each successful write op SHALL add one `activity_log` row (actor, op name, summary, duration) in the same transaction as its changes.

#### Scenario: Create then rename an account
- **WHEN** an account is created and renamed
- **THEN** activity_log has `accounts.create` and `accounts.update` rows marked ok

---

### Requirement: Failed writes are logged
- id: AUDIT-005
- entities: ActivityLog
- enforced: `run` catch src/core/api/index.ts:134-143
- test: activity_log records writes and failures; audit.forRow shows row history

A failed write op by a signed-in member SHALL add an `activity_log` row with `ok = 0` and the error code; read ops are not logged.

#### Scenario: Rename a locked account
- **WHEN** `accounts.update` on Bank fails with `account_locked`
- **THEN** the newest activity row is `accounts.update`, not ok, `account_locked`

---

### Invariant: activity_log rows change only by age
- id: AUDIT-006
- entities: ActivityLog
- enforced: triggers `activity_log_no_update` src/core/migrations/0005_drop_uid.sql:210 and `activity_log_prune` :212-218 (`log_immutable`)
- test: activity_log rows are pruned only after activity_log_days

`activity_log` rows SHALL never be updated, and SHALL be deleted only when older than `activity_log_days`.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Requirement: Prune the activity log on start
- id: AUDIT-007
- entities: ActivityLog, Setting
- enforced: `pruneActivityLog` src/core/migrate.ts:17-23; called after migrate in src/ui/lib/api.ts:19
- test: pruneActivityLog drops only rows older than activity_log_days

`pruneActivityLog` SHALL delete `activity_log` rows older than `activity_log_days` and nothing before setup.

#### Scenario: 400-day-old row
- **WHEN** retention is 365 days and one row is 400 days old
- **THEN** only that row is deleted

---

### Invariant: Retention is a positive whole number of days
- id: AUDIT-008
- entities: Setting
- enforced: default '365' src/core/setup.ts:58; API min 1 src/core/api/settings.ts:88; CHECK digits only src/core/migrations/0007_audit_columns.sql:104
- test: before setup only setup.run and currencies.list work; setup runs once

`activity_log_days` SHALL start at 365 and stay a whole number of days of at least 1 through the API.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Requirement: Activity list
- id: AUDIT-009
- entities: ActivityLog
- enforced: API `activity.list` src/core/api/logs.ts:5-21
- test: activity_log records writes and failures; audit.forRow shows row history

`activity.list` SHALL return activity rows newest first, paged, with the actor's name, op, summary, ok flag, error code and duration.

#### Scenario: Newest first
- **WHEN** four writes happened
- **THEN** the newest is the first row

---

### Requirement: Row history
- id: AUDIT-010
- entities: AuditLog
- enforced: API `audit.forRow` src/core/api/logs.ts:26-39 (`row_not_found`)
- test: activity_log records writes and failures; audit.forRow shows row history

`audit.forRow` SHALL take a table from a fixed list and a row id that exists, and return its audit rows oldest first with actor name and parsed old/new JSON.

#### Scenario: Renamed account
- **WHEN** the history of a created and renamed account is read
- **THEN** it shows insert 'A' then update 'B'

---

### Invariant: Six audit columns on every data table
- id: AUDIT-011
- entities: Currency, Actor, Setting, FxRate, Account, Entry, Line, MemberPin
- enforced: table definitions src/core/migrations/0007_audit_columns.sql:51-224; CHECK `(deleted_at IS NULL) = (deleted_by IS NULL)`
- test: every table but the logs has the six audit columns; deleted_by pairs with deleted_at

Every table but the two logs SHALL have created_at, updated_at, created_by, updated_by, deleted_at and deleted_by, with deleted_by set exactly when deleted_at is set.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Invariant: Settings rows stay
- id: AUDIT-012
- entities: Setting
- enforced: trigger `settings_update` src/core/migrations/0007_audit_columns.sql:433-440 (`setting_key_fixed`, `no_delete`)
- test: every table but the logs has the six audit columns; deleted_by pairs with deleted_at

A setting's key SHALL never change and a setting SHALL never be soft deleted.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Requirement: Write times come from the API clock
- id: AUDIT-013
- entities: Entry, Line, Account, Actor
- enforced: `ctx.now` src/core/api/index.ts:82, 122; `update` src/core/api/ctx.ts:83-87
- test: entries.update and entries.delete stamp the injected clock

Timestamps the API writes (updated_at, deleted_at, archived_at) SHALL come from the injected clock.

#### Scenario: Edit with a fixed clock
- **WHEN** the API runs with a fixed `now` and an entry is edited and deleted
- **THEN** replaced lines, the entry's updated_at and its deleted_at carry that time

---

### Requirement: Invalid input and unknown ops
- id: AUDIT-014
- entities: Op
- enforced: `run` src/core/api/index.ts:114-117 (`unknown_op`, `invalid_input`)
- test: bad input fails with invalid_input and an unknown op with unknown_op

An unknown op name SHALL fail with `unknown_op`, and input that fails the op's schema SHALL fail with `invalid_input` before any database work.

#### Scenario: Bad date
- **WHEN** `entries.post` gets date 2026-13-01
- **THEN** it fails with `invalid_input`

---

### Requirement: Database errors surface as stable codes
- id: AUDIT-015
- entities: ApiError
- enforced: `toApiError` src/core/api/errors.ts:36-45; code lists :3-22
- test: entries: post, number, balances, and database rules as codes

A trigger error SHALL reach the caller as its code, a known UNIQUE failure as its mapped code, and anything else as `internal`.

#### Scenario: Placeholder account through the API
- **WHEN** `entries.post` hits the `account_placeholder` trigger
- **THEN** the ApiError code is `account_placeholder`

---

### Requirement: Migrations apply once, in order
- id: AUDIT-016
- entities: Database
- enforced: `migrate` src/core/migrate.ts:7-15
- test: migrate applies all files once and sets user_version

`migrate` SHALL apply each file after `PRAGMA user_version` in its own transaction and set `user_version` to the file count.

#### Scenario: Second run
- **WHEN** migrate runs twice
- **THEN** the second run applies nothing

---

### Requirement: A newer database is refused
- id: AUDIT-017
- entities: Database
- enforced: `migrate` src/core/migrate.ts:10 (`database is newer than the app`)
- test: migrate refuses a database newer than the app

`migrate` SHALL throw when `user_version` is above the number of migrations.

#### Scenario: Version 99
- **WHEN** the file has user_version 99
- **THEN** migrate fails with "newer than the app"

---

### Invariant: A batch is one transaction
- id: AUDIT-018
- entities: Database
- enforced: `Db.batch` contract src/core/db.ts:11-15
- test: batch rolls back every statement on error

All statements of one batch SHALL commit together or not at all.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Invariant: Money stays within safe integers
- id: AUDIT-019
- entities: Line
- enforced: adapter contract src/core/db.ts:1-2
- test: integers round-trip up to the safe limit and fail above it

Integer values SHALL round-trip up to Number.MAX_SAFE_INTEGER and fail above it rather than lose precision.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Invariant: Table rebuilds keep every row
- id: AUDIT-020
- entities: Database
- enforced: src/core/migrations/0005_drop_uid.sql, 0006_slim_settings_fx.sql
- test: 0005 and 0006 keep every row and id when they rebuild tables

Migrations that rebuild tables SHALL keep every row, id and foreign key.

> Last verified: 2026-10-13 (commit 9bc514c)

<!-- uncertainty: failed open write ops while locked (setup.run) are not logged; signIn and setPin log their own failures. -->
<!-- uncertainty: currencies and member_pins have no audit trigger (member_pins on purpose, per 0012 header). -->
