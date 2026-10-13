---
owner: product-lead
status: active
---

# Architecture

Product decisions and scope. Ledger model, account template, currencies: [ledger-model](backend/database/ledger-model.md). Stack, database rules, API: [local-first](backend/architecture/overview.md).

## Decisions
- **Accounting standards first.** Users know accounting. The UI shows the ledger as it is: Chart of Accounts, General Journal, Account Register, reports.
- **Double entry is mandatory.** Each entry has ≥2 lines. Total debit = total credit in the base currency. A DB trigger enforces it; the API checks it first.
- **Local and private.** One SQLite file holds one ledger for one family. No server and no sign-in.
- **Members.** An `admin` manages members and book settings and edits any entry. A `member` edits only own entries. Everyone reads every entry. The Journal shows who wrote each entry.
- **Book settings are admin only:** language, country, lock date, activity log days, group name. A member edits only their own name. Triggers check it again.
- **Country sets the format.** Date and number format come from the book country (`und-<country>` locale). The UI language picks only the words. Dates are numeric.
- **Records are editable.** Soft delete only. `audit_log` (triggers) keeps every change with its actor. An optional `lock_date` closes a period.
- An entry belongs to the member who wrote it. The chart is shared. The account owner is an optional label, not a posting rule.
- AI, auto-fill and bank import are out of scope.

## Scope
- **v1 (desktop only):** setup, Chart of Accounts, General Journal, Account Register, trial balance / balance sheet / income statement, Quick Entry (Gider, Gelir, Transfer, Borç), members, exchange rates, backup and restore, activity log.
- **Later:** [ROADMAP](ROADMAP.md#later).
