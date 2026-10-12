---
owner: main
status: active
---

# Architecture

Product and ledger model. Technical stack, database rules and API: [LOCAL-FIRST](LOCAL-FIRST.md).

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

## Ledger model (GnuCash)
| GnuCash | aa-finance |
|---|---|
| `transactions` | `entries` |
| `splits` | `lines` |
| split `quantity` (account commodity) | `amount` (account currency) |
| split `value` (transaction currency) | `base_amount` (base currency) |
| `accounts.placeholder` | `accounts.is_placeholder` |
| `accounts.parent_guid` | `accounts.parent_id` |
| account `code` | `accounts.code` (hidden in the UI, orders the tree) |
| account commodity | `accounts.currency_id` (every account) |

Amounts are signed: plus is debit, minus is credit. Rules the database enforces for every writer: [LOCAL-FIRST](LOCAL-FIRST.md#database-rules). A receipt with several categories is one entry with one line per category.

## Account template
`src/core/chart.ts` is the single source of the starting chart. `setup()` applies it once.

| Part | Content |
|---|---|
| Roots (locked) | Varlık, Borç, Özkaynak, Gelir, Gider. |
| Asset groups (locked) | Nakit, Banka, Yatırım, Duran Varlıklar, and the single account Kişilerden Alacaklar. |
| Debt groups (locked) | Kredi Kartları, Krediler, and the single account Kişilere Borçlar. |
| System accounts (locked) | Açılış Bakiyesi, Kambiyo Kâr/Zararları, Banka Ücreti. |
| Starter (free) | Cüzdan under Nakit, in both options. |
| Recommended (free) | About 40 income and expense categories, named in the setup language. Optional at setup. |

- A locked account keeps its name, parent, type, group flag and archive state, and cannot be deleted. Its UI name comes from i18n by `system_key`.
- Code that posts to a fixed account finds it by `system_key`, never by name or code.
- The New Account dialog asks for name, group and currency. Code and type follow from the group.

## Multi-currency
- Every account has one currency. The base currency is chosen at setup and never changes.
- Each line: `amount` + `base_amount` + `rate`. Rates are manual (Exchange Rates page).
- A foreign line takes its base amount from `baseAmount`, else `rate`, else the stored rate on or before the entry date. A rounding gap of up to one minor unit per converted line goes to FX Gains and Losses.

## Scope
- **v1 (desktop only):** setup, Chart of Accounts, General Journal, Account Register, trial balance / balance sheet / income statement, Quick Entry (Gider, Gelir, Transfer, Borç), members, exchange rates, backup and restore, activity log.
- **Later:** [ROADMAP](ROADMAP.md#later).
