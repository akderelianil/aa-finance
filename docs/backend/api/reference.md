---
owner: backend-engineer
status: generated
---

# API reference (generated)

Generated from `ops` in `src/core/api/index.ts`, `src/core/api/errors.ts` and `src/ui/i18n/en.ts` by `scripts/gen-api-docs.ts`. Do not edit by hand: run `npm run docs:api`. A test fails when this file is out of date. Behavior and rules: [operations](operations.md).

## Operations (39)

| Operation | Kind | Access | Input fields |
|---|---|---|---|
| `accounts.archive` | write | signed in | `id`, `archived` |
| `accounts.create` | write | signed in | `parent`, `name`, `currency`, `placeholder`, `owner` |
| `accounts.delete` | write | signed in | `id` |
| `accounts.list` | read | signed in | `asOf`, `owner` |
| `accounts.register` | read | signed in | `id`, `from`, `to`, `page`, `pageSize` |
| `accounts.update` | write | signed in | `id`, `name`, `parent`, `currency`, `placeholder`, `owner` |
| `accounts.usage` | read | signed in | - |
| `activity.list` | read | signed in | `page`, `pageSize` |
| `audit.forRow` | read | signed in | `table`, `id` |
| `contacts.balances` | read | signed in | - |
| `contacts.create` | write | signed in | `kind`, `name`, `incomeAccount`, `expenseAccount`, `partners` |
| `contacts.delete` | write | signed in | `id` |
| `contacts.list` | read | signed in | - |
| `contacts.update` | write | signed in | `id`, `name`, `incomeAccount`, `expenseAccount`, `partners` |
| `currencies.list` | read | open | - |
| `entries.delete` | write | signed in | `id` |
| `entries.deleteAll` | write | signed in | - |
| `entries.get` | read | signed in | `id` |
| `entries.list` | read | signed in | `from`, `to`, `search`, `owner`, `page`, `pageSize` |
| `entries.post` | write | signed in | `date`, `reference`, `description`, `lines` |
| `entries.update` | write | signed in | `id`, `date`, `reference`, `description`, `lines` |
| `fx.delete` | write | signed in | `id` |
| `fx.get` | read | signed in | `currency`, `date` |
| `fx.list` | read | signed in | `currency` |
| `fx.set` | write | signed in | `currency`, `date`, `rate` |
| `members.add` | write | signed in | `name`, `role`, `color` |
| `members.list` | read | open | - |
| `members.remove` | write | signed in | `id` |
| `members.resetPin` | write | signed in | `id` |
| `members.setPin` | write | open | `id`, `pin`, `current` |
| `members.signIn` | write | open | `id`, `pin` |
| `members.update` | write | signed in | `id`, `name`, `role`, `color` |
| `reports.balanceSheet` | read | signed in | `asOf`, `owner` |
| `reports.incomeStatement` | read | signed in | `from`, `to`, `owner` |
| `reports.trialBalance` | read | signed in | `asOf`, `owner` |
| `settings.get` | read | signed in | - |
| `settings.groupName` | read | open | - |
| `settings.update` | write | signed in | `language`, `lockDate`, `activityLogDays`, `userName`, `groupName`, `country` |
| `setup.run` | write | open | `baseCurrency`, `language`, `userName`, `recommended`, `country`, `groupName`, `color`, `members`, `pin` |

`open` ops run with no member signed in; every other op fails with `locked` (`not_setup` before setup).

## Error codes (80)

| Code | Origin | English message |
|---|---|---|
| `account_archived` | trigger | The account is archived; it takes no entries. Unarchive it in the Chart of Accounts or pick another. |
| `account_deleted` | trigger | The account is deleted. Pick another account. |
| `account_field_fixed` | trigger | Account type and system data cannot change. Create a new account. |
| `account_has_children` | trigger | An account with child accounts cannot be deleted. Move or delete the children first, or archive it. |
| `account_has_lines` | trigger | An account with entries keeps its currency, cannot become a group and cannot be deleted. Create a new account or archive it. |
| `account_locked` | trigger | A system account cannot change. Add your own account under it. |
| `account_name_taken` | unique | This group already has an account with this name. Use another name. |
| `account_parent_cycle` | trigger | An account cannot move under itself. Pick another parent. |
| `account_parent_missing` | trigger | Parent account not found. |
| `account_parent_type` | trigger | The parent account must have the same type. Pick a group of the same type. |
| `account_placeholder` | trigger | A group account takes no entries; pick one of its child accounts. |
| `actor_kind_fixed` | trigger | A member's kind cannot be changed. |
| `actor_role_invalid` | trigger | The role is not valid. Pick admin or member. |
| `admin_only` | trigger | Only an admin can do this. Ask an admin. |
| `already_setup` | unique | The book is already set up. |
| `base_currency_fixed` | trigger | The base currency cannot change. Set up a new book if you need another. |
| `base_currency_missing` | trigger | No base currency is set. |
| `contact_account_type` | trigger | The default account must be an Income or Expense account that takes entries. |
| `contact_deleted` | trigger | This Directory record was deleted. |
| `contact_has_lines` | trigger | This record has journal lines and cannot be deleted. You can rename it. |
| `contact_insert_deleted` | trigger | A deleted contact cannot be added. |
| `contact_kind_fixed` | trigger | The kind of a Directory record does not change. |
| `contact_link_exists` | unique | This Brand and Business are already linked. |
| `contact_link_fixed` | trigger | The contacts of a link cannot be changed. |
| `contact_link_kind` | trigger | Only a Brand and a Business link to each other. |
| `contact_name_taken` | unique | This name is already in the Directory. Use another name. |
| `currency_fixed` | trigger | An account with entries keeps its currency. Create a new account. |
| `currency_unknown` | trigger | Unknown currency. Pick one from the list. |
| `entry_insert_draft` | trigger | An entry must start as a draft. |
| `entry_not_draft` | trigger | Entry lines change only in a draft. |
| `entry_not_owner` | trigger | Only the member who wrote this entry or an admin can change it. Ask an admin. |
| `entry_number_fixed` | trigger | The entry number cannot change. |
| `entry_posted` | trigger | A posted entry keeps its date. Delete the entry and enter it again. |
| `entry_too_few_lines` | trigger | An entry needs at least two lines. Add another line. |
| `entry_unbalanced` | trigger | Total debit and total credit are not equal. Add the balancing line or fix an amount. |
| `fx_base_currency` | api | The base currency has no rate. |
| `fx_rate_exists` | unique | A rate for this date already exists. Edit it in Exchange Rates. |
| `internal` | api | Something unexpected went wrong. Try again; if it persists, take a backup and report it from Settings. |
| `invalid_input` | api | The input is not valid. Check the fields and try again. |
| `last_admin` | trigger | At least one admin must remain. Make another member an admin first. |
| `line_base_mismatch` | trigger | The base amount of the line does not match the amount. |
| `line_base_sign` | api | Amount and base amount must have the same sign. |
| `line_date_mismatch` | trigger | The line date must equal the entry date. |
| `line_entry_fixed` | trigger | A line cannot move to another entry. |
| `line_insert_deleted` | trigger | A deleted line cannot be added. |
| `line_rate_required` | trigger | A foreign-currency line needs a rate. Enter it or add it under Exchange Rates. |
| `locked` | api | The app is locked. Enter your PIN to open it. |
| `log_immutable` | trigger | The history cannot change. |
| `member_name_taken` | api | A member with this name already exists. Use another name. |
| `member_not_found` | trigger | Member not found. |
| `member_remove_self` | api | You cannot remove yourself. Ask another admin. |
| `member_role_missing` | trigger | The member has no role. Pick admin or member. |
| `no_delete` | trigger | Records are not deleted; they are marked deleted. Delete from the record screen. |
| `not_setup` | api | The book is not set up yet. |
| `period_locked` | trigger | This period is locked; entries cannot change. An admin can clear the lock date in Settings. |
| `pin_current_required` | api | Enter the current PIN too. |
| `pin_exists` | unique | This member already has a PIN. Go back to the member list and enter it. |
| `pin_not_own` | api | You can change only your own PIN. An admin resets anyone else’s. |
| `pin_not_set` | api | This member has no PIN yet. Set one first. |
| `pin_reset_self` | api | You cannot reset your own PIN. Use Change PIN. |
| `pin_wait` | api | Too many tries. Wait a moment and try again. |
| `quick_amount` | api | The amount must be greater than zero. Enter the amount. |
| `quick_amount_required` | api | The currencies differ. Enter the other amount too. |
| `quick_currency_unsupported` | api | Quick Entry does not support this currency mix. Use a free entry. |
| `quick_debt_account` | api | The debt account is not valid. Pick another account. |
| `quick_expense_account` | api | Pick an expense account. |
| `quick_fee_account` | api | Pick an expense account for the fee. |
| `quick_from_account` | api | The source must be an asset account. Pick another account. |
| `quick_income_account` | api | Pick an income account. |
| `quick_money_account` | api | The money account is not valid. Pick another account. |
| `quick_payment_account` | api | The payment account must be an asset or a card account. Pick another account. |
| `quick_rate_required` | api | A rate is needed. Enter it or add it under Exchange Rates. |
| `quick_receive_account` | api | The receiving account must be an asset account. Pick another account. |
| `quick_same_account` | api | Source and target cannot be the same account. Change one. |
| `quick_split_mismatch` | api | The items must add up to the amount. Fix the items. |
| `quick_to_account` | api | The target must be an asset or a card account. Pick another account. |
| `rate_missing` | api | No rate on this date. Enter the rate or add it under Exchange Rates. |
| `row_deleted` | trigger | A deleted record cannot change. |
| `setting_key_fixed` | trigger | A setting name cannot change. |
| `unknown_op` | api | Unknown operation. |

Origins: `trigger` = database trigger, `unique` = unique constraint, `api` = API check.
