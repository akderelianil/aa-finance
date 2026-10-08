---
owner: main
status: active
---

# Architecture (v0.3)

## Decisions
- **Stack:** Supabase (PostgreSQL + Auth + RLS + Storage) + TypeScript Edge Functions (business logic, direct Postgres connection, one transaction) + React/Vite/shadcn desktop web app on Cloudflare. Migrations: Supabase CLI (`supabase/migrations`). The app or function generates UUID v7. Sign-in: email + password (Google later). Storage: Supabase Storage (R2 later, for backups).
- **API contract:** Edge Functions (`supabase/functions/*`) and DB views/functions (`account_balances`, `contact_balances`, `investment_holdings`, `report_totals`, `report_cash_flow`).
- **Double entry is mandatory:** each record has ≥2 lines; total debit = total credit in the base currency. The DB uses a deferred constraint trigger; the app validates too.
- **Write = Edge Function. Read = direct, through RLS.** Clients cannot write to tables.
- **Records are editable.** A DB trigger writes every change to `audit_log` (actor = `app.member_id`). Delete = soft delete. Optional `groups.lock_date` locks a period.
- **Access:** everyone in a group sees everything. Only the owner member (`journal_entries.member_id`) edits or deletes a record.
- **Each record belongs to one member.** The member whose card or money paid owns the expense or income. No joint accounts. The family report = the sum of members (money in and out of the home). Categories are group-level.
- **Product principle: accounting standards first.** Users know accounting. The UI shows the ledger as it is: Chart of Accounts, General Journal, Account Register, reports. The server derives what it can (rate, base amount); a user-given value wins.
- AI, auto-fill and bank import are out of scope.

## Ledger model (GnuCash)
The ledger follows the GnuCash SQL model.

| GnuCash | aa-finance |
|---|---|
| `transactions` | `journal_entries` |
| `splits` | `journal_lines` |
| split `quantity` (account commodity) | `amount` + `currency` |
| split `value` (transaction currency) | `base_amount` (group base currency) |
| `accounts.placeholder` | `accounts.is_placeholder` |
| `accounts.parent_guid` | `accounts.parent_id` |

The DB enforces these rules for every writer (`20261008030000_ledger_integrity.sql`):
- An entry balances on `base_amount` and has ≥2 lines (deferred trigger).
- A line cannot post to a placeholder account.
- A line account is in the entry's group. A balance-sheet line account belongs to the entry member.
- A line on a balance-sheet account is in that account's currency. A base-currency line has `amount` = `base_amount`.
- An account with lines keeps its type and currency, and cannot become a placeholder.

A receipt with more than one category is one entry with one line per category (`items` in `transaction-create` and `transaction-update`).

## Account template
`apply_account_template(group_id)` (`20261008040000_account_template.sql`) is the single source of the starting chart. Onboarding calls it for a new group; the migration ran it for existing groups. It is idempotent.

| Part | Content |
|---|---|
| Categories | 2-level expense and income tree. `is_placeholder` is set per node; after that it is a manual setting. |
| `template_key` | Stable id of a template category. The user can rename, move or archive it. |
| Brands | Common brands (`contacts.kind='brand'`) with a default category. An existing brand keeps its own category. |
| Member accounts | Each member gets "Nakit" (`subtype='cash'`) and "Açılış Bakiyesi" (`opening_balance`) in the base currency. |

- Code that posts to a fixed category finds it with `findTemplateCategory(key)`: `loan_fee`, `loan_cost`, `cash_advance_fee`, `deposit_return`, `deposit_break_fee`. Never find it by name.
- A category name is unique within its type (`findOrCreateCategory` finds by name). Do not add a second "Diğer" under a parent.
- Balance-sheet accounts have no template tree: a parent must have the same owner and currency. The UI groups them by `subtype`. The start wizard (`/baslangic`) asks for bank accounts, cards and loans.

## Multi-currency
- Categories have no currency. A balance-sheet account has one currency.
- Each line: original amount + currency + base-currency amount (`base_amount`) + rate.
- **Buying FX:** the user enters "bought 100 USD, paid 4,000 TRY". Rate = 40, derived.
- **Card spend abroad:** the user enters the USD/EUR amount. The TRY estimate uses the last rate (`is_estimated=true`). The user can confirm it with the bank's TRY amount.
- **Spending or selling from an FX account:** use the account's average cost (total base / total amount). The market-value gap goes to the `fx_gain_loss` category automatically.
- **Period-end revaluation:** one-tap revaluation record for unrealized FX gain/loss (`source_type='fx_revaluation'`).

## Investments
- Types: crypto, commodity (gold/silver/oil), stock, fund, bond/bill. No domestic/foreign split; each instrument has its own currency.
- FX is not an instrument. It is a normal multi-currency account.
- One investment account per member per instrument. The first buy opens it (`accounts.instrument_id`).
- Book value = market value (revaluation record with a manually entered price). A sale reduces book value pro rata by quantity; the gap goes to `investment_gain_loss`. No lot or tax-cost tracking.
- Cross-currency: a USD stock can be bought with TRY or from a USD account. The gap is derived.

## Scope
- **v1 (desktop only):** Chart of Accounts, General Journal, Account Register, trial balance / balance sheet / income statement, group/members, multi-currency.
- **Hidden (code kept, no route):** quick entry, Directory, debts, installments, cash advance, loan, term deposit, investments, plans, start wizard. Rebuild on `journal-post`.
- **Later:** bills, subscriptions, budget, period close, reconcile, scheduled entries.

## Rules the app enforces (the DB does not)
- Only the record owner edits or deletes. No change before `lock_date`.
- Editing a past record recalculates the average cost (the account's lines in date order).
