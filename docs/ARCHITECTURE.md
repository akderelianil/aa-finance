---
owner: main
status: active
---

# Architecture (v0.2)

## Decisions
- **Stack:** Supabase (PostgreSQL + Auth + RLS + Storage) + TypeScript Edge Functions (business logic, direct Postgres connection, one transaction) + React/Vite/shadcn PWA on Cloudflare. Migrations: Supabase CLI (`supabase/migrations`). The app or function generates UUID v7. Sign-in: email + password (Google later). Storage: Supabase Storage (R2 later, for backups).
- **API contract:** Edge Functions (`supabase/functions/*`) and DB views/functions (`account_balances`, `contact_balances`, `investment_holdings`, `report_totals`, `report_cash_flow`).
- **Double entry is mandatory:** each record has ≥2 lines; total debit = total credit in the base currency. The DB uses a deferred constraint trigger; the app validates too.
- **Write = Edge Function. Read = direct, through RLS.** Clients cannot write to tables.
- **Records are editable.** A DB trigger writes every change to `audit_log` (actor = `app.member_id`). Delete = soft delete. Optional `groups.lock_date` locks a period.
- **Access:** everyone in a group sees everything. Only the owner member (`journal_entries.member_id`) edits or deletes a record.
- **Each record belongs to one member.** The member whose card or money paid owns the expense or income. No joint accounts. The family report = the sum of members (money in and out of the home). Categories are group-level.
- **UX principle: minimum input, zero mandatory fields.** The server derives every derivable value: rate, TRY amount, average cost, FX and investment gain/loss, account creation, installment schedule. These request fields are optional; a user-given value wins. The user never sees accounting terms.
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

A receipt with more than one category is one entry with one line per category (`transaction-create` `items`).

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
- **v1:** ledger, accounts/categories, group/members, quick entry, Directory + debts, installments, **cash advance and loan** (decided 2026-10-07), investments (manual price), attachments, trial balance/balance sheet/income statement, cash flow.
- **Later:** bills, subscriptions, budget, period close, automatic rates/prices.

## Rules the app enforces (the DB does not)
- Only the record owner edits or deletes. No change before `lock_date`.
- Editing a past record recalculates the average cost (the account's lines in date order).
