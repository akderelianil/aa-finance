# Spec: accounts-chart

> Auto-extracted by spec-miner. Last mined: 2026-10-13.
> Source: src/core/chart.ts, src/core/setup.ts, src/core/api/accounts.ts, src/core/api/settings.ts (setup), src/core/migrations/0007_audit_columns.sql, 0010_account_owner.sql
> Last verified: 2026-10-13 (commit 32d9165)

Scope: the Chart of Accounts (Hesap Planı): setup template, five locked roots, locked system groups, free accounts, tree rules, currency per account, placeholder, archive, soft delete, account owner, account list balances and usage. Each block lists `id`, `entities`, `enforced` (file:line) and the exact title of the covering test (`NONE` when no test covers it).

---

### Requirement: Setup writes the chart template
- id: ACCT-001
- entities: Account, Setting
- enforced: `setupStatements` src/core/setup.ts:62-75; template src/core/chart.ts:10-27
- test: setup writes the core chart, optional recommended accounts, and runs once

Setup SHALL write the locked core accounts (five roots plus system groups such as Cash, Bank, Receivables, Payables, Opening Balances, FX Gains and Losses, Bank Fees) with a `system_key`, one unlocked Wallet, and the recommended income and expense accounts only when asked, all in the base currency.

#### Scenario: Without recommended accounts
- **WHEN** setup runs with `recommended: false`
- **THEN** the chart has the core accounts (locked), five roots and one Wallet

#### Scenario: With recommended accounts
- **WHEN** setup runs with `recommended: true`
- **THEN** the unlocked accounts are the recommended ones plus Wallet, named in the setup language, typed from their parent

---

### Requirement: Setup runs once
- id: ACCT-002
- entities: Setting
- enforced: API `setup.run` src/core/api/settings.ts:24 (`already_setup`); UNIQUE `settings.key` src/core/migrations/0007_audit_columns.sql:101 mapped in src/core/api/errors.ts:20
- test: before setup only setup.run and currencies.list work; setup runs once

A second `setup.run` SHALL fail with `already_setup` and change nothing.

#### Scenario: Second setup
- **WHEN** `setup.run` is called on a file that is already set up
- **THEN** it fails with `already_setup`

---

### Invariant: Only the five locked roots have no parent
- id: ACCT-003
- entities: Account
- enforced: CHECK `parent_id IS NOT NULL OR (locked = 1 AND system_key = type)` src/core/migrations/0007_audit_columns.sql:159
- test: account tree rules

Every account except the five locked roots (system_key = type) SHALL have a parent.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Invariant: Locked accounts cannot change
- id: ACCT-004
- entities: Account
- enforced: trigger `accounts_update` src/core/migrations/0007_audit_columns.sql:263 (`account_locked`)
- test: account tree rules

A locked account (roots and system groups) SHALL NOT be renamed, moved, archived, deleted or otherwise updated.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Invariant: Lock flag, system key and type are fixed
- id: ACCT-005
- entities: Account
- enforced: trigger `accounts_update` src/core/migrations/0007_audit_columns.sql:264-265 (`account_field_fixed`)
- test: account tree rules

An account's `locked`, `system_key` and `type` SHALL never change after insert.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Create an account under a parent
- id: ACCT-006
- entities: Account
- enforced: API `accounts.create` src/core/api/accounts.ts:65-81 (`account_not_found`, `currency_unknown`)
- test: accounts: create under a parent, rename, move, archive, delete

`accounts.create` SHALL take the type from the live parent, default the currency to the base currency and the owner to the parent's owner, and trim the name.

#### Scenario: New bank account
- **WHEN** an account ' Akbank ' is created under Bank with no currency
- **THEN** it is named 'Akbank', typed asset, in TRY, unlocked

---

### Invariant: Parent is live and of the same type
- id: ACCT-007
- entities: Account
- enforced: triggers `accounts_insert` src/core/migrations/0007_audit_columns.sql:251-256 and `accounts_update` :266-270 (`account_parent_missing`, `account_parent_type`); API src/core/api/accounts.ts:68, 91 (`account_not_found`)
- test: account tree rules

An account's parent SHALL be a live account of the same type.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Invariant: The tree has no cycles
- id: ACCT-008
- entities: Account
- enforced: trigger `accounts_update` src/core/migrations/0007_audit_columns.sql:271-277 (`account_parent_cycle`)
- test: account tree rules

Moving an account SHALL NOT make it its own ancestor.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Invariant: Sibling names are unique
- id: ACCT-009
- entities: Account
- enforced: unique index `accounts_sibling_name` src/core/migrations/0007_audit_columns.sql:167; mapped to `account_name_taken` src/core/api/errors.ts:16
- test: accounts: create under a parent, rename, move, archive, delete

Two live accounts under the same parent SHALL NOT share a name.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Rename and move an account
- id: ACCT-010
- entities: Account
- enforced: API `accounts.update` src/core/api/accounts.ts:83-97
- test: accounts: create under a parent, rename, move, archive, delete

`accounts.update` SHALL change name, parent, currency, placeholder flag and owner of a live account, subject to the tree rules.

#### Scenario: Move to another type
- **WHEN** an asset account is moved under Expenses
- **THEN** it fails with `account_parent_type`

---

### Invariant: Every account has one currency
- id: ACCT-011
- entities: Account, Currency
- enforced: `currency_id NOT NULL` src/core/migrations/0007_audit_columns.sql:153; API src/core/api/accounts.ts:70, 93 (`currency_unknown`); trigger :278-281 (`account_has_lines`)
- test: amounts: integers only, nonzero, same sign; base and rate follow the account currency

Every account SHALL have a known currency, and its currency SHALL NOT change while it has live lines.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Invariant: Placeholder accounts hold no lines
- id: ACCT-012
- entities: Account, Line
- enforced: triggers `lines_insert` src/core/migrations/0007_audit_columns.sql:358 (`account_placeholder`) and `accounts_update` :278-281 (`account_has_lines`)
- test: account tree rules

A placeholder (group) account SHALL take no lines, and an account with live lines SHALL NOT become a placeholder.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Archive and unarchive
- id: ACCT-013
- entities: Account
- enforced: API `accounts.archive` src/core/api/accounts.ts:99-103; trigger `lines_insert` src/core/migrations/0007_audit_columns.sql:357 (`account_archived`)
- test: accounts: create under a parent, rename, move, archive, delete

`accounts.archive` SHALL set or clear `archived_at`; an archived account stays in `accounts.list` with `archived: true` and takes no new lines.

#### Scenario: Archive
- **WHEN** a free account is archived
- **THEN** the list shows it as archived and a new line on it fails with `account_archived`

---

### Requirement: Soft delete an account
- id: ACCT-014
- entities: Account
- enforced: API `accounts.delete` src/core/api/accounts.ts:106-110 (`account_not_found`); trigger `accounts_update` src/core/migrations/0007_audit_columns.sql:278-284 (`account_has_lines`, `account_has_children`)
- test: accounts: create under a parent, rename, move, archive, delete

`accounts.delete` SHALL soft delete an account only when it has no live lines and no live children; a deleted account leaves the list and a second delete fails with `account_not_found`.

#### Scenario: Account with lines
- **WHEN** an account with posted lines is deleted
- **THEN** the call fails with `account_has_lines`

---

### Invariant: A deleted account is final
- id: ACCT-015
- entities: Account
- enforced: trigger `accounts_update` src/core/migrations/0007_audit_columns.sql:262 (`row_deleted`)
- test: NONE

A soft-deleted account SHALL NOT be updated again.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Account owner
- id: ACCT-016
- entities: Account, Member
- enforced: triggers `accounts_owner_insert`/`accounts_owner_update` src/core/migrations/0010_account_owner.sql:7-23 (`member_not_found`); API default src/core/api/accounts.ts:75
- test: account owner: Aile, Kişi and Ortak filter reports and the journal

An account MAY have one live member as owner (null = shared); a new child takes its parent's owner unless one is given.

#### Scenario: Unknown owner
- **WHEN** an account is created with owner 999
- **THEN** it fails with `member_not_found`

---

### Requirement: Account list with balances
- id: ACCT-017
- entities: Account, Line
- enforced: API `accounts.list` src/core/api/accounts.ts:23-53
- test: entries: post, number, balances, and database rules as codes

`accounts.list` SHALL return all live accounts with their own signed balance (account currency) and base balance from live lines up to `asOf`; with `owner`, only lines of that owner count.

#### Scenario: Balance as of a date
- **WHEN** the list is read with `asOf` before the second posting
- **THEN** the Wallet balance counts only the first posting

---

### Requirement: Most used accounts
- id: ACCT-018
- entities: Account, Line
- enforced: API `accounts.usage` src/core/api/accounts.ts:56-62
- test: accounts.usage lists accounts used in the last 180 days, most used first, ignoring old entries

`accounts.usage` SHALL return up to 40 account ids with live lines in the last 180 days, most lines first, ties by most recent date.

#### Scenario: Old entries ignored
- **WHEN** an account was used only in 2020
- **THEN** it is not in the result

<!-- uncertainty: accounts.create/update/archive/delete have no role check (src/core/api/accounts.ts), so any signed-in member can change the shared chart. No product rule says whether this is intended. -->
