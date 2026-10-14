# Spec: ledger-entries

> Auto-extracted by spec-miner. Last mined: 2026-10-13.
> Source: src/core/api/entries.ts, src/core/api/accounts.ts (register), src/core/api/index.ts, src/core/migrations/0007_audit_columns.sql, 0009_line_contacts.sql, 0011_line_member.sql
> Last verified: 2026-10-13 (commit 32d9165)

Scope: posting, editing and deleting journal entries (Yevmiye), line rules, balance on `base_amount`, FX rounding, per-year numbering, `lock_date`, the General Journal list and the Account Register. Each block lists `id`, `entities`, `enforced` (file:line) and the exact title of the covering test (`NONE` when no test covers it).

---

### Requirement: Post a new entry
- id: LEDGER-001
- entities: Entry, Line
- enforced: API `entries.post` src/core/api/entries.ts:94-105; trigger `entries_insert` src/core/migrations/0007_audit_columns.sql:288-296
- test: entries: post, number, balances, and database rules as codes

`entries.post` SHALL insert a draft entry, write its resolved lines and post it in one transaction, returning `{ id, year, number }`.

#### Scenario: Balanced post
- **WHEN** a signed-in member posts a dated entry with two lines that sum to zero
- **THEN** the entry is stored as `posted` and the call returns its id, year and number

---

### Requirement: At least two lines
- id: LEDGER-002
- entities: Entry, Line
- enforced: API input `lines` minLength(2) src/core/api/entries.ts:30 (`invalid_input`); trigger `entry_too_few_lines` src/core/migrations/0007_audit_columns.sql:311-313
- test: posting needs two balanced lines and assigns numbers per year

An entry SHALL NOT move from draft to posted with fewer than two live lines.

#### Scenario: One line
- **WHEN** a draft entry with one live line is posted
- **THEN** the write fails with `entry_too_few_lines` (or `invalid_input` at the API)

---

### Requirement: At most 500 lines per call
- id: LEDGER-003
- entities: Entry, Line
- enforced: API input `lines` maxLength(500) src/core/api/entries.ts:30
- test: NONE

`entries.post` and `entries.update` SHALL reject more than 500 lines with `invalid_input`.

#### Scenario: Too many lines
- **WHEN** a call sends 501 lines
- **THEN** it fails with `invalid_input`

---

### Requirement: Entry balances on base_amount
- id: LEDGER-004
- entities: Entry, Line
- enforced: API `resolve` src/core/api/entries.ts:69-71 (`entry_unbalanced`); trigger `entries_update` src/core/migrations/0007_audit_columns.sql:314-316 (`entry_unbalanced`)
- test: posting needs two balanced lines and assigns numbers per year

Posting SHALL fail with `entry_unbalanced` when the live lines' `base_amount` sum is not zero.

#### Scenario: Unbalanced lines
- **WHEN** lines of 5 and -4 in the base currency are posted
- **THEN** the call fails with `entry_unbalanced` and nothing is written

---

### Requirement: Amounts are nonzero integers
- id: LEDGER-005
- entities: Line
- enforced: API `amount` z.int + nonzero src/core/api/entries.ts:7; STRICT INTEGER and CHECK `amount <> 0` src/core/migrations/0007_audit_columns.sql:212
- test: amounts: integers only, nonzero, same sign; base and rate follow the account currency

A line amount SHALL be a nonzero integer in minor units; floats and zero are rejected.

#### Scenario: Fractional amount
- **WHEN** a line amount of 1.5 is written
- **THEN** the write fails (`invalid_input` at the API, STRICT type error in the database)

---

### Requirement: base_amount has the sign of amount
- id: LEDGER-006
- entities: Line
- enforced: API `line_base_sign` src/core/api/entries.ts:66; CHECK on `base_amount` src/core/migrations/0007_audit_columns.sql:213
- test: amounts: integers only, nonzero, same sign; base and rate follow the account currency

A line's `base_amount` SHALL be nonzero and have the same sign as `amount`.

#### Scenario: Opposite sign
- **WHEN** a USD line has amount 100 and base -4100
- **THEN** the write fails (`line_base_sign` at the API, CHECK in the database)

---

### Requirement: Base-currency lines carry no rate
- id: LEDGER-007
- entities: Line, Account
- enforced: API src/core/api/entries.ts:53-54 (`line_base_mismatch`); triggers `lines_insert`/`lines_update` src/core/migrations/0007_audit_columns.sql:360-362, 386-388
- test: entries: post, number, balances, and database rules as codes

A line on a base-currency account SHALL have `base_amount = amount` and no rate, else `line_base_mismatch`.

#### Scenario: Rate on a TRY line
- **WHEN** a line on a TRY account (base TRY) is posted with `rate: '2'`
- **THEN** the call fails with `line_base_mismatch`

---

### Requirement: Foreign-currency lines store a rate
- id: LEDGER-008
- entities: Line, Account
- enforced: triggers `lines_insert`/`lines_update` src/core/migrations/0007_audit_columns.sql:363, 389 (`line_rate_required`)
- test: amounts: integers only, nonzero, same sign; base and rate follow the account currency

A line on a non-base-currency account SHALL be stored with a non-null rate.

#### Scenario: Raw insert without rate
- **WHEN** a USD line is inserted with a base amount but no rate
- **THEN** the database rejects it with `line_rate_required`

---

### Requirement: FX rounding goes to FX Gains and Losses
- id: LEDGER-009
- entities: Entry, Line, Account
- enforced: API `resolve` src/core/api/entries.ts:69-74 (`entry_unbalanced`, `not_setup`)
- test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate

When converted lines leave a base difference of at most one minor unit per converted line, the API SHALL add a balancing line on the `fx_gain_loss` account; a larger difference fails with `entry_unbalanced`.

#### Scenario: One-kuruş rounding
- **WHEN** two 0.01 USD lines at 33.335 and a -0.67 TRY line are posted
- **THEN** a fourth line of +1 kuruş is written on FX Gains and Losses

#### Scenario: More than rounding
- **WHEN** one converted line leaves a difference larger than 1
- **THEN** the call fails with `entry_unbalanced`

---

### Requirement: Number per year on first post
- id: LEDGER-010
- entities: Entry
- enforced: trigger `entries_number` src/core/migrations/0007_audit_columns.sql:320-333
- test: posting needs two balanced lines and assigns numbers per year

On its first post an entry SHALL get `year` = year of `entry_date` and `number` = highest number of that year + 1.

#### Scenario: New year restarts at 1
- **WHEN** entries dated 2026-03-01, 2026-03-02 and 2027-01-05 are posted
- **THEN** they get (2026, 1), (2026, 2) and (2027, 1)

---

### Requirement: Entries are inserted as unnumbered drafts
- id: LEDGER-011
- entities: Entry
- enforced: trigger `entries_insert` src/core/migrations/0007_audit_columns.sql:291-292 (`entry_insert_draft`)
- test: posting needs two balanced lines and assigns numbers per year

A new entry row SHALL be inserted as a live draft without a number.

#### Scenario: Insert as posted
- **WHEN** an entry row is inserted with `state = 'posted'`
- **THEN** the database rejects it with `entry_insert_draft`

---

### Invariant: Entry numbers never change
- id: LEDGER-012
- entities: Entry
- enforced: trigger `entries_update` src/core/migrations/0007_audit_columns.sql:306-308 (`entry_number_fixed`)
- test: posting needs two balanced lines and assigns numbers per year

Once assigned, an entry's `year` and `number` SHALL never change, including through edits.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Invariant: Entry numbers are never reused
- id: LEDGER-013
- entities: Entry
- enforced: unique index `entries_number (year, number)` over all rows src/core/migrations/0007_audit_columns.sql:194
- test: a soft-deleted entry takes its lines with it, is final, and keeps its number

A soft-deleted entry SHALL keep its number, and later entries SHALL continue after it.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Invariant: Posted lines change only through draft
- id: LEDGER-014
- entities: Entry, Line
- enforced: triggers `lines_insert`/`lines_update` src/core/migrations/0007_audit_columns.sql:351-352, 375-376 (`entry_not_draft`); `entries_update` :309-310 (`entry_posted`)
- test: lines of a posted entry change only through draft, and the number stays

Lines SHALL be inserted or updated only while their entry is a live draft, and a posted entry's date SHALL change only through draft.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Text-only edit in place
- id: LEDGER-015
- entities: Entry
- enforced: API `entries.update` src/core/api/entries.ts:116-118, 132-133
- test: entries.update changes text in place, lines and date through draft; delete keeps the number

When only `reference` or `description` changes, `entries.update` SHALL update the posted entry in place without touching lines.

#### Scenario: New description
- **WHEN** `entries.update` sends only `description` and `reference`
- **THEN** the entry keeps its lines and number and shows the new text

---

### Requirement: Line or date edit goes through draft
- id: LEDGER-016
- entities: Entry, Line
- enforced: API `entries.update` src/core/api/entries.ts:121-131
- test: entries.update changes text in place, lines and date through draft; delete keeps the number

When `lines` or a new `date` is given, `entries.update` SHALL set the entry to draft, soft delete the old live lines (only when new lines are given), write the new lines, and post again, keeping the number.

#### Scenario: Replace lines and date
- **WHEN** an entry gets a new date and three new lines
- **THEN** reading it returns the new date, the three lines in order and the old number

---

### Requirement: Date-only edit keeps converted amounts
- id: LEDGER-017
- entities: Entry, Line
- enforced: API `entries.update` src/core/api/entries.ts:121-131; trigger `entries_date_sync` src/core/migrations/0007_audit_columns.sql:335-339
- test: NONE
- status: unverified

When only the date changes, existing lines SHALL keep their `base_amount` and `rate`; the API does not look up the stored rate for the new date again.

#### Scenario: Move a USD entry to another date
- **WHEN** a posted entry with a USD line gets only a new `date`
- **THEN** the line's base amount and rate stay as first posted

---

### Invariant: Line date equals entry date
- id: LEDGER-018
- entities: Entry, Line
- enforced: triggers `lines_insert`/`lines_update` src/core/migrations/0007_audit_columns.sql:354-355, 378-379 (`line_date_mismatch`); `entries_date_sync` :335-339
- test: lines of a posted entry change only through draft, and the number stays

Every live line's `entry_date` SHALL equal its entry's `entry_date`; a date change on the entry is copied to its live lines.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Soft delete an entry
- id: LEDGER-019
- entities: Entry, Line
- enforced: API `entries.delete` src/core/api/entries.ts:147-152 (`entry_not_found`); trigger `entries_soft_delete` src/core/migrations/0007_audit_columns.sql:341-346
- test: a soft-deleted entry takes its lines with it, is final, and keeps its number

`entries.delete` SHALL set `deleted_at` on the entry and its live lines; the entry then reads as `entry_not_found` and leaves all balances.

#### Scenario: Delete then read
- **WHEN** an entry is deleted and then requested with `entries.get`
- **THEN** the read fails with `entry_not_found`

---

### Invariant: A soft-deleted entry is final
- id: LEDGER-020
- entities: Entry, Line
- enforced: triggers `entries_update` src/core/migrations/0007_audit_columns.sql:301 and `lines_update` :374 (`row_deleted`)
- test: a soft-deleted entry takes its lines with it, is final, and keeps its number

A soft-deleted entry or line SHALL NOT be updated again, including restoring it.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Lines need a usable account
- id: LEDGER-021
- entities: Line, Account
- enforced: API src/core/api/entries.ts:45-47 (`account_not_found`); trigger `lines_insert` src/core/migrations/0007_audit_columns.sql:356-358 (`account_deleted`, `account_archived`, `account_placeholder`)
- test: lines need a usable account

A line SHALL NOT be written to a missing, deleted, archived or placeholder account.

#### Scenario: Placeholder account
- **WHEN** a line targets the Cash group (placeholder)
- **THEN** the write fails with `account_placeholder`

---

### Requirement: lock_date freezes the closed period
- id: LEDGER-022
- entities: Entry, Setting
- enforced: triggers `entries_insert` src/core/migrations/0007_audit_columns.sql:293-294 and `entries_update` :302-304 (`period_locked`)
- test: lock_date freezes entries on or before it

Entries dated on or before `lock_date` SHALL NOT be inserted, changed, reposted or deleted, and no entry SHALL be moved into that period.

#### Scenario: Post into a locked period
- **WHEN** `lock_date` is 2026-03-31 and an entry dated 2026-03-31 is posted
- **THEN** it fails with `period_locked`

#### Scenario: Edit after the lock
- **WHEN** an entry dated 2026-04-01 gets a new description
- **THEN** the change succeeds

---

### Invariant: lock_date is a date or empty
- id: LEDGER-023
- entities: Setting
- enforced: CHECK on settings src/core/migrations/0007_audit_columns.sql:103; API `lockDate` z.iso.date src/core/api/settings.ts:87
- test: lock_date freezes entries on or before it

The `lock_date` setting SHALL be NULL or a valid `YYYY-MM-DD` date.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Delete all entries
- id: LEDGER-024
- entities: Entry, Line
- enforced: API `entries.deleteAll` src/core/api/entries.ts:155-165 (`admin_only`); trigger `period_locked` src/core/migrations/0007_audit_columns.sql:302-304
- test: entries.deleteAll: admin only, soft deletes every entry, keeps accounts, a locked period stops it

`entries.deleteAll` SHALL be admin only, soft delete every live entry in one transaction, keep accounts and settings, and return the count; one entry in a locked period aborts the whole call.

#### Scenario: Locked period
- **WHEN** `lock_date` covers one of the live entries
- **THEN** the call fails with `period_locked` and no entry is deleted

---

### Requirement: Line contact must be live
- id: LEDGER-025
- entities: Line, Contact
- enforced: API src/core/api/entries.ts:52 (`contact_not_found`); trigger `lines_contact_insert` src/core/migrations/0009_line_contacts.sql:6-13 (`contact_deleted`)
- test: contact on a debt line: balances per contact, a used contact cannot be removed, the line keeps it on edit

A line's `contact` SHALL reference a live Rehber record when the line is written.

#### Scenario: Unknown contact
- **WHEN** a line names contact 999
- **THEN** the post fails with `contact_not_found`

---

### Requirement: Line member must be live
- id: LEDGER-026
- entities: Line, Member
- enforced: API src/core/api/entries.ts:51 (`member_not_found`); trigger `lines_member_insert` src/core/migrations/0011_line_member.sql:7-14
- test: line member: a line belongs to its member, else to its account owner

A line's `member` SHALL reference a live user actor when the line is written.

#### Scenario: Unknown member
- **WHEN** a line names member 999
- **THEN** the post fails with `member_not_found`

---

### Requirement: Read one entry
- id: LEDGER-027
- entities: Entry, Line, Member
- enforced: API `entries.get` src/core/api/entries.ts:186-218 (`entry_not_found`)
- test: entries.update changes text in place, lines and date through draft; delete keeps the number

`entries.get` SHALL return a live entry with its author and its live lines in position order.

#### Scenario: Read after edit
- **WHEN** an edited entry is read
- **THEN** only the live lines come back, ordered by position

---

### Requirement: General Journal list
- id: LEDGER-028
- entities: Entry
- enforced: API `entries.list` src/core/api/entries.ts:221-243; paging src/core/api/ctx.ts:52-59
- test: journal list pages newest first and searches; register runs a balance

`entries.list` SHALL return live entries newest first (date, then id), paged (default 50, max 1000), filtered by date range and by a search on description and reference where `%` and `_` match literally.

#### Scenario: Literal wildcard search
- **WHEN** the search text is `%_`
- **THEN** only the entry whose description contains `%_` is returned

---

### Requirement: Journal owner filter
- id: LEDGER-029
- entities: Entry, Line, Account, Member
- enforced: API `entries.list` src/core/api/entries.ts:224-229; `ownerSql` src/core/api/ctx.ts:48-51
- test: account owner: Aile, Kişi and Ortak filter reports and the journal

With `owner`, `entries.list` SHALL return entries with at least one live line whose owner (line member, else account owner) matches; `shared` matches lines with no owner.

#### Scenario: Entry with a shared line
- **WHEN** an entry touches a member's account and a shared income account
- **THEN** it appears under that member and under `shared`

---

### Requirement: Account Register
- id: LEDGER-030
- entities: Account, Line, Entry
- enforced: API `accounts.register` src/core/api/accounts.ts:136-190 (`account_not_found`)
- test: journal list pages newest first and searches; register runs a balance

`accounts.register` SHALL return an account's live lines oldest first, paged, with the opening balance before `from` and a running balance in the account currency, plus the other account when the entry has exactly one other line.

#### Scenario: Second page
- **WHEN** page 1 of size 3 is read from 2026-02-01
- **THEN** the running balance continues from page 0 and `otherCount` shows the other lines

---

### Invariant: Writes run one at a time
- id: LEDGER-031
- entities: Entry
- enforced: `createApi` write queue src/core/api/index.ts:86-99
- test: writes at the same time run one after another

Write operations SHALL run one after another, so concurrent posts get consecutive numbers.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: A given rate wins over a given base
- id: LEDGER-032
- entities: Line
- enforced: API `resolve` src/core/api/entries.ts:58-66
- test: a given rate wins over a given base amount, which wins over the stored rate

When a foreign line sends both `rate` and `baseAmount`, the API SHALL convert with the rate and ignore the base amount; any rounding gap goes to FX Gains and Losses.

#### Scenario: Both given
- **WHEN** a USD line sends amount 100, baseAmount 3000 and rate '34'
- **THEN** the line stores base 3400 and rate '34'

---

### Invariant: Moving an entry to another year keeps its first number
- id: LEDGER-033
- entities: Entry
- enforced: trigger `entries_number` (runs only when number IS NULL) src/core/migrations/0007_audit_columns.sql:320-322; `entry_number_fixed` :306-308
- test: NONE
- status: unverified

An entry whose date moves to another year SHALL keep the `year` and `number` from its first post, so `year` can differ from the year of `entry_date`.

> Last verified: 2026-10-13 (commit 32d9165)

<!-- uncertainty: LEDGER-017 and LEDGER-033 come from reading the code; no test shows whether they are intended. -->
<!-- deferred: src/core/test/node-db.ts, src-tauri adapters (safe-integer refusal) -->
