---
owner: main
status: active
---

# Architecture (v0.3)

## Decisions
- **Stack:** Supabase (PostgreSQL + Auth + RLS + Storage) + TypeScript Edge Functions (business logic, direct Postgres connection, one transaction) + React/Vite/shadcn desktop web app on Cloudflare. Migrations: Supabase CLI (`supabase/migrations`). The app or function generates UUID v7. Sign-in: email + password (Google later). Storage: Supabase Storage (R2 later, for backups).
- **API contract:** Edge Functions (`supabase/functions/*`) and DB views/functions (`account_balances`, `account_tree_balances`, `account_period_totals(from, to)`, `contact_ledger_balances`; hidden flows: `contact_balances`, `investment_holdings`, `report_totals`, `report_cash_flow`).
- **Double entry is mandatory:** each record has ≥2 lines; total debit = total credit in the base currency. The DB uses a deferred constraint trigger; the app validates too.
- **Write = Edge Function. Read = direct, through RLS.** Clients cannot write to tables.
- **`journal-post` is the general write path** (create / update / delete one entry from a line list). Each line: `account_id`, `side`, `amount` (account currency), optional `rate` or `base_amount`, `memo`, `contact_id` (Rehber tag). It locks the line accounts, checks the balance (`unbalanced`) and soft-deletes with `softDeleteEntry`. Entries of hidden flows with link tables (installment, deposit, loan, investment) are not editable here.
- **Records are editable.** A DB trigger writes every change to `audit_log` (actor = `app.member_id`). Delete = soft delete. Optional `groups.lock_date` locks a period.
- **Access:** everyone in a group sees everything. Only the owner member (`journal_entries.member_id`) edits or deletes a record.
- **Each journal entry belongs to one member** (the member who entered it). The group keeps one shared Chart of Accounts. The account owner (`owner_member_id`) is an optional label on any account type, not a posting rule.
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

| GnuCash | aa-finance |
|---|---|
| account `code` | `accounts.code` (hidden in the UI, orders the tree, unique per group) |
| account commodity | `accounts.currency` (every account) |

The DB enforces these rules for every writer (`20261008030000_ledger_integrity.sql`, `20261008060000_ledger_core_accounts.sql`):
- An entry balances on `base_amount` and has ≥2 lines (deferred trigger).
- A line cannot post to a placeholder account.
- A line account is in the entry's group.
- A line is in its account's currency. A base-currency line has `amount` = `base_amount`.
- An account with lines keeps its type and currency, and cannot become a placeholder.
- A parent has the same group and type, and is not a system account. Owner and currency can differ.
- Every account has a currency and a code (digits and dots: `1`, `1.02`, `1.02.01`). The UI does not show codes.

A receipt with more than one category is one entry with one line per category (`items` in `transaction-create` and `transaction-update`).

## Account template
`apply_account_template(group_id)` (`20261008090000_simple_chart.sql`) is the single source of the starting chart. Onboarding calls it first, then creates the system and member accounts. It is idempotent.

| Part | Content |
|---|---|
| Roots (locked) | `1` Varlık, `2` Borç, `3` Özkaynak, `4` Gelir, `5` Gider. |
| Asset groups (locked) | Nakit (`cash`), Banka (`bank`), Yatırım, Duran Varlıklar, and the single account Kişilerden Alacaklar (`receivable`). |
| Debt groups (locked) | Kredi Kartı (`credit_card`), Krediler (`loan`), and the single account Kişilere Borçlar (`payable`). |
| Income, expense | About 40 free categories: nine income accounts; expense groups (Yeme-İçme, Ulaşım, Araç, Konut, Fatura, Sağlık, Kişisel Bakım, Alışveriş, Eğlence & Hobi, Finansman Giderleri) with sub-accounts. |
| `template_key` | Stable id of a template node (`a_bank`, `groceries`, `loan_fee`, …). The user can rename, move or archive a free node. |
| Brands | Common brands with a default expense account (Rehber). |

- `accounts.locked`: a locked account keeps its name, parent, type, kind, group flag and archive state, and cannot be deleted (trigger `accounts_locked_*`, Edge Functions return `locked_account`). Owner and currency can change.
- Trigger `accounts_defaults` (insert): a missing currency = base currency; a missing parent = the default group (`account_default_parent`: cash → Nakit, bank/deposit → Banka, investment → Yatırım, credit card → Kredi Kartı, loan → Krediler, opening balance → Özkaynak, income → Gelir, expense → Gider, else the root); a missing kind = the parent kind; a missing code = `account_next_code(parent)`.
- `account_next_code`: parent code + first free `.NN` suffix.
- The New Account dialog asks for name, group, currency and owner. The group gives type and kind. Code, type and kind are not asked.
- Code that posts to a fixed account finds it by `template_key` (`findTemplateCategory`), never by name or code.

## Decisions
- **Stack:** Supabase (PostgreSQL + Auth + RLS + Storage) + TypeScript Edge Functions (business logic, direct Postgres connection, one transaction) + React/Vite/shadcn desktop web app on Cloudflare. Migrations: Supabase CLI (`supabase/migrations`). The app or function generates UUID v7. Sign-in: email + password (Google later). Storage: Supabase Storage (R2 later, for backups).
- **API contract:** Edge Functions (`supabase/functions/*`) and DB views/functions (`account_balances`, `account_tree_balances`, `account_period_totals(from, to)`, `contact_ledger_balances`; hidden flows: `contact_balances`, `investment_holdings`, `report_totals`, `report_cash_flow`).
- **Double entry is mandatory:** each record has ≥2 lines; total debit = total credit in the base currency. The DB uses a deferred constraint trigger; the app validates too.
- **Write = Edge Function. Read = direct, through RLS.** Clients cannot write to tables.
- **`journal-post` is the general write path** (create / update / delete one entry from a line list). Each line: `account_id`, `side`, `amount` (account currency), optional `rate` or `base_amount`, `memo`, `contact_id` (Rehber tag). It locks the line accounts, checks the balance (`unbalanced`) and soft-deletes with `softDeleteEntry`. Entries of hidden flows with link tables (installment, deposit, loan, investment) are not editable here.
- **Records are editable.** A DB trigger writes every change to `audit_log` (actor = `app.member_id`). Delete = soft delete. Optional `groups.lock_date` locks a period.
- **Access:** everyone in a group sees everything. Only the owner member (`journal_entries.member_id`) edits or deletes a record.
- **Each journal entry belongs to one member** (the member who entered it). The group keeps one shared Chart of Accounts. The account owner (`owner_member_id`) is an optional label on any account type, not a posting rule.
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

| GnuCash | aa-finance |
|---|---|
| account `code` | `accounts.code` (hidden in the UI, orders the tree, unique per group) |
| account commodity | `accounts.currency` (every account) |

The DB enforces these rules for every writer (`20261008030000_ledger_integrity.sql`, `20261008060000_ledger_core_accounts.sql`):
- An entry balances on `base_amount` and has ≥2 lines (deferred trigger).
- A line cannot post to a placeholder account.
- A line account is in the entry's group.
- A line is in its account's currency. A base-currency line has `amount` = `base_amount`.
- An account with lines keeps its type and currency, and cannot become a placeholder.
- A parent has the same group and type, and is not a system account. Owner and currency can differ.
- Every account has a currency and a code (digits and dots: `1`, `1.02`, `1.02.01`). The UI does not show codes.

A receipt with more than one category is one entry with one line per category (`items` in `transaction-create` and `transaction-update`).

## Account template
`apply_account_template(group_id)` (`20261008060000_ledger_core_accounts.sql`) is the single source of the starting chart. Onboarding calls it first, then creates the system and member accounts. It is idempotent.

| Part | Content |
|---|---|
| Balance sheet (TDHP) | `1` Dönen Varlıklar (10 → 100 Kasa, 102 Bankalar; 11 → 118; 13 → 136; 19), `2` Duran Varlıklar (25 → 252, 254, 255), `3` KVYK (30 → 300 Banka Kredileri, 309 Kredi Kartları; 33 → 336), `4` UVYK (40 → 400), `5` Özkaynaklar (50 → 500 Sermaye). All placeholders. |
| Income | `60` Ücret Gelirleri (600–602), `64` Diğer Olağan Gelir ve Kârlar (640, 642, 645, 646, 649.xx), `67` → `679.xx`. |
| Expense | `77` → `770` Genel Giderler (`770.01` … `770.99`, sub-levels `770.02.01`), `78` → `780` Finansman Giderleri (`780.01` …). |
| `template_key` | Stable id of a template node (`b100`, `e770`, `loan_fee`, …). The user can rename, move or archive it. |
| Brands | Common brands with a default expense account (Rehber). |

- Trigger `accounts_defaults` (insert): a missing currency = base currency; a missing parent = the default group (`account_default_parent`: cash → 100, bank/deposit → 102, investment → 118, receivable → 136, credit card → 309, loan → 300, payable → 336, opening balance → 500, income → 649, expense → 770); a missing code = `account_next_code(parent)`.
- `account_next_code`: a 1–2 digit parent takes the first free digit (`10` → `101`); else the first free 2-digit suffix (`100` → `100.01`).
- Code that posts to a fixed account finds it by `template_key` (`findTemplateCategory`), never by name or code.

## Multi-currency
- Every account has one currency. Income and expense accounts get the base currency by default.
- Each line: original amount + currency + base-currency amount (`base_amount`) + rate.
- **Buying FX:** the user enters "bought 100 USD, paid 4,000 TRY". Rate = 40, derived.
- **Card spend abroad:** the user enters the USD/EUR amount. The TRY estimate uses the last rate (`is_estimated=true`). The user can confirm it with the bank's TRY amount.
- **Spending or selling from an FX account:** use the account's average cost (total base / total amount). The market-value gap goes to the `fx_gain_loss` category automatically.
- **Day rate** (`dayRate`, also `fx-rate` for the form): the saved rate of the day, else the TCMB indicative rate (ForexBuying, last published day on or before the date; base TRY only; saved to `fx_rates`), else the last saved rate. A user-given rate is saved too.
- **Period-end revaluation:** one-tap revaluation record for unrealized FX gain/loss (`source_type='fx_revaluation'`).

## Investments
- Types: crypto, commodity (gold/silver/oil), stock, fund, bond/bill. No domestic/foreign split; each instrument has its own currency.
- FX is not an instrument. It is a normal multi-currency account.
- One investment account per member per instrument. The first buy opens it (`accounts.instrument_id`).
- Book value = market value (revaluation record with a manually entered price). A sale reduces book value pro rata by quantity; the gap goes to `investment_gain_loss`. No lot or tax-cost tracking.
- Cross-currency: a USD stock can be bought with TRY or from a USD account. The gap is derived.

## Scope
- **v1 (desktop only):** Chart of Accounts, General Journal, Account Register, trial balance / balance sheet / income statement, group/members, multi-currency.
- **Hidden (code kept, no route):** quick entry, debts, installments, cash advance, loan, term deposit, investments, plans, start wizard. Rebuild on `journal-post`.
- **Later:** bills, subscriptions, budget, period close, reconcile, scheduled entries.

## Rules the app enforces (the DB does not)
- Only the record owner edits or deletes. No change before `lock_date`.
- Editing a past record recalculates the average cost (the account's lines in date order).
