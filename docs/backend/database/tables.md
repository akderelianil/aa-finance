---
owner: backend-engineer
status: active
---

# Tables (v1)

Columns besides the common ones. Rules: [rules](rules.md).

| Table | Columns (besides common) |
|---|---|
| `actors` | `kind` (user, plugin, system), `name`, `role` (admin, member), `color` |
| `settings` | `key`, `value` (base currency, language, country, group name, `lock_date`, `activity_log_days`) |
| `currencies` | `code`, `name`, `minor_unit` |
| `fx_rates` | `date`, `currency_id`, `rate` (manual entry) |
| `accounts` | `parent_id`, `name`, `type`, `currency_id`, `is_placeholder`, `locked`, `system_key`, `archived_at` |
| `entries` | `entry_date`, `year`, `number`, `reference`, `description`, `state` |
| `contacts` | `kind` (individual, brand, business), `name`, `default_income_account_id`, `default_expense_account_id` |
| `brand_businesses` | `brand_id`, `business_id` (many-to-many link) |
| `lines` | `entry_id`, `account_id`, `entry_date`, `amount`, `base_amount`, `rate`, `memo`, `position` |
| `actors` grants | `can_manage_accounts`, `can_manage_rates`, `can_manage_contacts` (0/1, default 0), migration `0013`. Triggers `*_permission_insert/update` on `accounts`, `fx_rates`, `contacts`, `brand_businesses` raise `permission_denied` unless the actor is a live admin, not a user, or a live member holding the grant (0014 added the live check). Only an admin changes them (`admin_only`); `audit_log` records the change |
| `member_pins` | `member_id`, `hash`, `salt`, `iterations` (PBKDF2-SHA256), `failed_count`, `wait_until` (epoch ms). One live row per member; no row = PIN not set. No audit trigger, so the hash never enters `audit_log`. A reset soft-deletes the row |
| `audit_log` | `table_name`, `row_id`, `op`, `old`, `new` (JSON), `actor_id`, `at` |
| `activity_log` | `actor_id`, `operation`, `summary`, `ok`, `error_code`, `duration_ms`, `at` |

- Amounts are signed: plus is debit, minus is credit. The UI shows Borç and Alacak from the sign.
- Base currency is chosen at setup and never changes. Every account has a currency. A line holds `amount` (account currency) and `base_amount` (base currency).
- Chart: types asset, liability, equity, income, expense. Template: `src/core/chart.ts`, applied by `setup()` (`src/core/setup.ts`) in the base currency. Core accounts are locked and have a `system_key` (5 roots, cash, bank, investments, fixed assets, receivables, credit cards, loans, payables, opening balance, FX gains and losses, bank fees); the UI shows their names from i18n by key, `name` is an English fallback. The Wallet starter is always added; the recommended income and expense accounts are an option at setup, named in the setup language. Investment gains/losses is not in v1.
- Members: one file = one group. `actors` of kind `user` are members with `role` (`admin`, `member`) and `color`; at least one admin stays. A member edits and deletes own entries (`created_by`); an admin edits and deletes all and manages members. Every member has a 6-digit PIN (`member_pins`, migration `0012`; existing members start with none and set one at first sign-in). It is an app gate: the file is not encrypted. The UI keeps the last member only to preselect it on the pick screen. Flow: [kurulum](../../product-designer/ux/kurulum.md).
- Book settings are admin only (trigger `settings_admin`, migration `0004`). Entry lists carry the `author` (the member who wrote it).
- Logs: `audit_log` (triggers, kept forever, in the SQLite file) answers "who changed this row". `activity_log` (written by the API, pruned by a setting) answers "who did what".
- Rehber (Directory), `0008_contacts.sql`: `contacts` (`kind` individual / brand / business, name unique, optional default income and expense account) and `brand_businesses` (many-to-many, brand ↔ business only; a trigger checks the kinds). A contact's kind never changes. The Rehber page (`/rehber`) exists. `lines.contact_id` (`0009`) links a line to a contact; only Borç sets it. `contacts.balances` sums a contact's open debt per currency from the Receivables / Payables lines. A contact with live lines cannot be deleted (`contact_has_lines`).
- Later: tags, dashboard, plugin data.
