# Spec: reports

> Auto-extracted by spec-miner. Last mined: 2026-10-13.
> Source: src/core/api/reports.ts, src/core/api/ctx.ts (ownerSql)
> Last verified: 2026-10-13 (commit 9bc514c)

Scope: trial balance (Mizan), balance sheet (Bilanço) with unclosed earnings, income statement (Gelir tablosu), and the Aile / Kişi / Ortak owner filter. All amounts are in the base currency, signed like lines (plus = debit). Each block lists `id`, `entities`, `enforced` (file:line) and the exact title of the covering test (`NONE` when no test covers it).

---

### Requirement: Trial balance
- id: REPORT-001
- entities: Account, Line
- enforced: API `reports.trialBalance` src/core/api/reports.ts:35-51
- test: reports: trial balance totals match, balance sheet closes with earnings, income statement by period

`reports.trialBalance` SHALL return every account with live lines up to `asOf`, with base debit turnover, credit turnover and balance, plus debit and credit balance totals that are equal for a balanced ledger.

#### Scenario: Three entries
- **WHEN** salary 1000.00, groceries 300.00 and a 50.00 payable are posted
- **THEN** both totals are 1050.00 and each row's debit minus credit equals its balance

---

### Requirement: Balance sheet with earnings
- id: REPORT-002
- entities: Account, Line
- enforced: API `reports.balanceSheet` src/core/api/reports.ts:57-62
- test: reports: trial balance totals match, balance sheet closes with earnings, income statement by period

`reports.balanceSheet` SHALL return asset, liability and equity balances up to `asOf` and `earnings` = income plus expense balances (minus is profit), so rows plus earnings sum to zero.

#### Scenario: Profit not yet closed
- **WHEN** income is 1000.00 and expense 300.00
- **THEN** earnings is -700.00 and the sheet closes to zero

---

### Requirement: Income statement for a period
- id: REPORT-003
- entities: Account, Line
- enforced: API `reports.incomeStatement` src/core/api/reports.ts:65-68
- test: reports: trial balance totals match, balance sheet closes with earnings, income statement by period

`reports.incomeStatement` SHALL return income and expense balances between `from` and `to` (both required, inclusive) and `net` = their sum (minus is profit).

#### Scenario: February only
- **WHEN** the period is 2026-02-01 to 2026-02-28
- **THEN** only the 300.00 grocery expense appears and net is 300.00

---

### Invariant: Reports are in the base currency
- id: REPORT-004
- entities: Line
- enforced: sums of `base_amount` src/core/api/reports.ts:16-24, 38-41
- test: reports: trial balance totals match, balance sheet closes with earnings, income statement by period

Every report amount SHALL be a sum of live lines' `base_amount`, signed plus for debit.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Requirement: Owner filter on reports
- id: REPORT-005
- entities: Line, Account, Member
- enforced: `LINE_OWNER` src/core/api/reports.ts:9; `ownerSql` src/core/api/ctx.ts:48-51
- test: account owner: Aile, Kişi and Ortak filter reports and the journal

With `owner`, every report SHALL count only lines whose owner (the line's member, else the account's owner) is that member; `shared` counts lines with no owner; no filter counts the whole family.

#### Scenario: One member's view
- **WHEN** the trial balance is read for a member who owns one account
- **THEN** only that account's lines appear

---

### Requirement: A line counts for its member
- id: REPORT-006
- entities: Line, Member
- enforced: `LINE_OWNER` src/core/api/reports.ts:9
- test: line member: a line belongs to its member, else to its account owner

A line with a `member` SHALL count for that member even on a shared or another member's account.

#### Scenario: Salary into the shared bank
- **WHEN** member B's salary is posted to the shared bank with `member: B`
- **THEN** B's income statement shows net -7.00 and the shared view shows none of it

---

### Requirement: Zero balances are left out
- id: REPORT-007
- entities: Account
- enforced: `HAVING balance <> 0` src/core/api/reports.ts:20
- test: NONE

The balance sheet and income statement SHALL omit accounts whose balance in the range is zero; the trial balance keeps every account with lines.

#### Scenario: Account back to zero
- **WHEN** an expense account nets to zero in the period
- **THEN** it is missing from the income statement

---

### Invariant: Balance queries read only the covering index
- id: REPORT-008
- entities: Line
- enforced: index `lines_account` src/core/migrations/0007_audit_columns.sql:229
- test: balance query reads only the covering index

The per-account balance query SHALL be answered from the `lines_account` covering index.

> Last verified: 2026-10-13 (commit 9bc514c)
