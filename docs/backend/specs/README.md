# Behavior specs

> Index of the mined behavior specs.
> Last verified: 2026-10-13 (commit 9bc514c)

Behavior specs for `src/core/`, one folder per capability. Each spec is a flat list of `### Requirement:` (triggered, with a `#### Scenario:`) and `### Invariant:` (always true) blocks. Every block carries a stable `id`, the `entities` it touches, where it is `enforced` (trigger error codes in `src/core/migrations/` and API code, with file:line) and the exact title of the test that covers it, or `NONE`. `status: unverified` marks behavior read from code that no test confirms and that may be unintended. `docs/RULES-TRACE.md` maps the CLAUDE.md product rules; these specs go one level deeper, per behavior.

Open questions found while mining: [FINDINGS](FINDINGS.md).

## Capabilities

| Capability | Spec | Ids | Scope |
|---|---|---|---|
| ledger-entries | [spec](ledger-entries/spec.md) | LEDGER-001 to 033 | post, update, delete, balance, numbering, FX rounding, lock_date, journal, register |
| accounts-chart | [spec](accounts-chart/spec.md) | ACCT-001 to 018 | setup template, locked roots and system groups, tree rules, currency, archive, delete, owner |
| quick-entry | [spec](quick-entry/spec.md) | QUICK-001 to 013 | Gider, Gelir, Transfer, Borç builders |
| members-and-pin | [spec](members-and-pin/spec.md) | MEMBER-001 to 022 | roles, own-entry rule, admin-only settings, last admin, PIN gate, wait counter |
| fx-rates | [spec](fx-rates/spec.md) | FX-001 to 016 | given base > given rate > stored rate on or before date > rate_missing; set, list, delete; conversion math |
| contacts | [spec](contacts/spec.md) | CONTACT-001 to 013 | Rehber, brand-business links, suggested accounts, debt balances |
| reports | [spec](reports/spec.md) | REPORT-001 to 008 | trial balance, balance sheet with earnings, income statement, owner filter |
| audit-and-logs | [spec](audit-and-logs/spec.md) | AUDIT-001 to 020 | soft delete only, audit_log, activity_log, prune, API envelope, migrations |

Totals: 143 blocks (95 Requirements, 48 Invariants); 11 with `test: NONE`; 3 marked `status: unverified`.

## All ids

| id | capability | enforced | test |
|---|---|---|---|
| LEDGER-001 | ledger-entries | API `entries.post` src/core/api/entries.ts:94-105; trigger `entries_insert` src/core/migrations/0007_audit_columns.sql:288-296 | test: entries: post, number, balances, and database rules as codes |
| LEDGER-002 | ledger-entries | API input `lines` minLength(2) src/core/api/entries.ts:30 (`invalid_input`); trigger `entry_too_few_lines` src/core/migrations/0007_audit_columns.sql:311-313 | test: posting needs two balanced lines and assigns numbers per year |
| LEDGER-003 | ledger-entries | API input `lines` maxLength(500) src/core/api/entries.ts:30 | test: NONE |
| LEDGER-004 | ledger-entries | API `resolve` src/core/api/entries.ts:69-71 (`entry_unbalanced`); trigger `entries_update` src/core/migrations/0007_audit_columns.sql:314-316 (`entry_unbalanced`) | test: posting needs two balanced lines and assigns numbers per year |
| LEDGER-005 | ledger-entries | API `amount` z.int + nonzero src/core/api/entries.ts:7; STRICT INTEGER and CHECK `amount <> 0` src/core/migrations/0007_audit_columns.sql:212 | test: amounts: integers only, nonzero, same sign; base and rate follow the account currency |
| LEDGER-006 | ledger-entries | API `line_base_sign` src/core/api/entries.ts:66; CHECK on `base_amount` src/core/migrations/0007_audit_columns.sql:213 | test: amounts: integers only, nonzero, same sign; base and rate follow the account currency |
| LEDGER-007 | ledger-entries | API src/core/api/entries.ts:53-54 (`line_base_mismatch`); triggers `lines_insert`/`lines_update` src/core/migrations/0007_audit_columns.sql:360-362, 386-388 | test: entries: post, number, balances, and database rules as codes |
| LEDGER-008 | ledger-entries | triggers `lines_insert`/`lines_update` src/core/migrations/0007_audit_columns.sql:363, 389 (`line_rate_required`) | test: amounts: integers only, nonzero, same sign; base and rate follow the account currency |
| LEDGER-009 | ledger-entries | API `resolve` src/core/api/entries.ts:69-74 (`entry_unbalanced`, `not_setup`) | test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate |
| LEDGER-010 | ledger-entries | trigger `entries_number` src/core/migrations/0007_audit_columns.sql:320-333 | test: posting needs two balanced lines and assigns numbers per year |
| LEDGER-011 | ledger-entries | trigger `entries_insert` src/core/migrations/0007_audit_columns.sql:291-292 (`entry_insert_draft`) | test: posting needs two balanced lines and assigns numbers per year |
| LEDGER-012 | ledger-entries | trigger `entries_update` src/core/migrations/0007_audit_columns.sql:306-308 (`entry_number_fixed`) | test: posting needs two balanced lines and assigns numbers per year |
| LEDGER-013 | ledger-entries | unique index `entries_number (year, number)` over all rows src/core/migrations/0007_audit_columns.sql:194 | test: a soft-deleted entry takes its lines with it, is final, and keeps its number |
| LEDGER-014 | ledger-entries | triggers `lines_insert`/`lines_update` src/core/migrations/0007_audit_columns.sql:351-352, 375-376 (`entry_not_draft`); `entries_update` :309-310 (`entry_posted`) | test: lines of a posted entry change only through draft, and the number stays |
| LEDGER-015 | ledger-entries | API `entries.update` src/core/api/entries.ts:116-118, 132-133 | test: entries.update changes text in place, lines and date through draft; delete keeps the number |
| LEDGER-016 | ledger-entries | API `entries.update` src/core/api/entries.ts:121-131 | test: entries.update changes text in place, lines and date through draft; delete keeps the number |
| LEDGER-017 | ledger-entries | API `entries.update` src/core/api/entries.ts:121-131; trigger `entries_date_sync` src/core/migrations/0007_audit_columns.sql:335-339 | test: NONE |
| LEDGER-018 | ledger-entries | triggers `lines_insert`/`lines_update` src/core/migrations/0007_audit_columns.sql:354-355, 378-379 (`line_date_mismatch`); `entries_date_sync` :335-339 | test: lines of a posted entry change only through draft, and the number stays |
| LEDGER-019 | ledger-entries | API `entries.delete` src/core/api/entries.ts:147-152 (`entry_not_found`); trigger `entries_soft_delete` src/core/migrations/0007_audit_columns.sql:341-346 | test: a soft-deleted entry takes its lines with it, is final, and keeps its number |
| LEDGER-020 | ledger-entries | triggers `entries_update` src/core/migrations/0007_audit_columns.sql:301 and `lines_update` :374 (`row_deleted`) | test: a soft-deleted entry takes its lines with it, is final, and keeps its number |
| LEDGER-021 | ledger-entries | API src/core/api/entries.ts:45-47 (`account_not_found`); trigger `lines_insert` src/core/migrations/0007_audit_columns.sql:356-358 (`account_deleted`, `account_archived`, `account_placeholder`) | test: lines need a usable account |
| LEDGER-022 | ledger-entries | triggers `entries_insert` src/core/migrations/0007_audit_columns.sql:293-294 and `entries_update` :302-304 (`period_locked`) | test: lock_date freezes entries on or before it |
| LEDGER-023 | ledger-entries | CHECK on settings src/core/migrations/0007_audit_columns.sql:103; API `lockDate` z.iso.date src/core/api/settings.ts:87 | test: lock_date freezes entries on or before it |
| LEDGER-024 | ledger-entries | API `entries.deleteAll` src/core/api/entries.ts:155-165 (`admin_only`); trigger `period_locked` src/core/migrations/0007_audit_columns.sql:302-304 | test: entries.deleteAll: admin only, soft deletes every entry, keeps accounts, a locked period stops it |
| LEDGER-025 | ledger-entries | API src/core/api/entries.ts:52 (`contact_not_found`); trigger `lines_contact_insert` src/core/migrations/0009_line_contacts.sql:6-13 (`contact_deleted`) | test: contact on a debt line: balances per contact, a used contact cannot be removed, the line keeps it on edit |
| LEDGER-026 | ledger-entries | API src/core/api/entries.ts:51 (`member_not_found`); trigger `lines_member_insert` src/core/migrations/0011_line_member.sql:7-14 | test: line member: a line belongs to its member, else to its account owner |
| LEDGER-027 | ledger-entries | API `entries.get` src/core/api/entries.ts:186-218 (`entry_not_found`) | test: entries.update changes text in place, lines and date through draft; delete keeps the number |
| LEDGER-028 | ledger-entries | API `entries.list` src/core/api/entries.ts:221-243; paging src/core/api/ctx.ts:52-59 | test: journal list pages newest first and searches; register runs a balance |
| LEDGER-029 | ledger-entries | API `entries.list` src/core/api/entries.ts:224-229; `ownerSql` src/core/api/ctx.ts:48-51 | test: account owner: Aile, Kişi and Ortak filter reports and the journal |
| LEDGER-030 | ledger-entries | API `accounts.register` src/core/api/accounts.ts:136-190 (`account_not_found`) | test: journal list pages newest first and searches; register runs a balance |
| LEDGER-031 | ledger-entries | `createApi` write queue src/core/api/index.ts:86-99 | test: writes at the same time run one after another |
| LEDGER-032 | ledger-entries | API `resolve` src/core/api/entries.ts:58-67 | test: NONE |
| LEDGER-033 | ledger-entries | trigger `entries_number` (runs only when number IS NULL) src/core/migrations/0007_audit_columns.sql:320-322; `entry_number_fixed` :306-308 | test: NONE |
| ACCT-001 | accounts-chart | `setupStatements` src/core/setup.ts:62-75; template src/core/chart.ts:10-27 | test: setup writes the core chart, optional recommended accounts, and runs once |
| ACCT-002 | accounts-chart | API `setup.run` src/core/api/settings.ts:24 (`already_setup`); UNIQUE `settings.key` src/core/migrations/0007_audit_columns.sql:101 mapped in src/core/api/errors.ts:20 | test: before setup only setup.run and currencies.list work; setup runs once |
| ACCT-003 | accounts-chart | CHECK `parent_id IS NOT NULL OR (locked = 1 AND system_key = type)` src/core/migrations/0007_audit_columns.sql:159 | test: account tree rules |
| ACCT-004 | accounts-chart | trigger `accounts_update` src/core/migrations/0007_audit_columns.sql:263 (`account_locked`) | test: account tree rules |
| ACCT-005 | accounts-chart | trigger `accounts_update` src/core/migrations/0007_audit_columns.sql:264-265 (`account_field_fixed`) | test: account tree rules |
| ACCT-006 | accounts-chart | API `accounts.create` src/core/api/accounts.ts:65-81 (`account_not_found`, `currency_unknown`) | test: accounts: create under a parent, rename, move, archive, delete |
| ACCT-007 | accounts-chart | triggers `accounts_insert` src/core/migrations/0007_audit_columns.sql:251-256 and `accounts_update` :266-270 (`account_parent_missing`, `account_parent_type`); API src/core/api/accounts.ts:68, 91 (`account_not_found`) | test: account tree rules |
| ACCT-008 | accounts-chart | trigger `accounts_update` src/core/migrations/0007_audit_columns.sql:271-277 (`account_parent_cycle`) | test: account tree rules |
| ACCT-009 | accounts-chart | unique index `accounts_sibling_name` src/core/migrations/0007_audit_columns.sql:167; mapped to `account_name_taken` src/core/api/errors.ts:16 | test: accounts: create under a parent, rename, move, archive, delete |
| ACCT-010 | accounts-chart | API `accounts.update` src/core/api/accounts.ts:83-97 | test: accounts: create under a parent, rename, move, archive, delete |
| ACCT-011 | accounts-chart | `currency_id NOT NULL` src/core/migrations/0007_audit_columns.sql:153; API src/core/api/accounts.ts:70, 93 (`currency_unknown`); trigger :278-281 (`account_has_lines`) | test: amounts: integers only, nonzero, same sign; base and rate follow the account currency |
| ACCT-012 | accounts-chart | triggers `lines_insert` src/core/migrations/0007_audit_columns.sql:358 (`account_placeholder`) and `accounts_update` :278-281 (`account_has_lines`) | test: account tree rules |
| ACCT-013 | accounts-chart | API `accounts.archive` src/core/api/accounts.ts:99-103; trigger `lines_insert` src/core/migrations/0007_audit_columns.sql:357 (`account_archived`) | test: accounts: create under a parent, rename, move, archive, delete |
| ACCT-014 | accounts-chart | API `accounts.delete` src/core/api/accounts.ts:106-110 (`account_not_found`); trigger `accounts_update` src/core/migrations/0007_audit_columns.sql:278-284 (`account_has_lines`, `account_has_children`) | test: accounts: create under a parent, rename, move, archive, delete |
| ACCT-015 | accounts-chart | trigger `accounts_update` src/core/migrations/0007_audit_columns.sql:262 (`row_deleted`) | test: NONE |
| ACCT-016 | accounts-chart | triggers `accounts_owner_insert`/`accounts_owner_update` src/core/migrations/0010_account_owner.sql:7-23 (`member_not_found`); API default src/core/api/accounts.ts:75 | test: account owner: Aile, Kişi and Ortak filter reports and the journal |
| ACCT-017 | accounts-chart | API `accounts.list` src/core/api/accounts.ts:23-53 | test: entries: post, number, balances, and database rules as codes |
| ACCT-018 | accounts-chart | API `accounts.usage` src/core/api/accounts.ts:56-62 | test: accounts.usage lists accounts used in the last 180 days, most used first, ignoring old entries |
| QUICK-001 | quick-entry | `expense` src/core/quick.ts:27-32 (`quick_payment_account`, `quick_expense_account`) | test: expense: splits on a card; a foreign payment converts with the last split taking the rounding |
| QUICK-002 | quick-entry | `income` src/core/quick.ts:35-40 (`quick_receive_account`, `quick_income_account`) | test: income: received into an asset, split over income accounts |
| QUICK-003 | quick-entry | `split` src/core/quick.ts:47-48 (`quick_amount`, `quick_split_mismatch`) | test: expense: splits on a card; a foreign payment converts with the last split taking the rounding |
| QUICK-004 | quick-entry | `split` src/core/quick.ts:50-64 (`quick_currency_unsupported`) | test: expense: splits on a card; a foreign payment converts with the last split taking the rounding |
| QUICK-005 | quick-entry | `split` src/core/quick.ts:65-75; `pair` src/core/quick.ts:142-153 | test: income: received into an asset, split over income accounts |
| QUICK-006 | quick-entry | `split` src/core/quick.ts:76-90 (`quick_currency_unsupported`, `quick_rate_required`) | test: expense: splits on a card; a foreign payment converts with the last split taking the rounding |
| QUICK-007 | quick-entry | `transfer` src/core/quick.ts:98-108 (`quick_same_account`, `quick_from_account`, `quick_to_account`) | test: transfer: ATM with fee, card payment, and across currencies |
| QUICK-008 | quick-entry | `transfer` src/core/quick.ts:105-107 (`quick_fee_account`); `pair` src/core/quick.ts:164-168 (`quick_currency_unsupported`) | test: transfer: a fee account in a third currency is rejected |
| QUICK-009 | quick-entry | `pair` src/core/quick.ts:154-170 (`quick_amount_required`, `quick_rate_required`) | test: transfer: ATM with fee, card payment, and across currencies |
| QUICK-010 | quick-entry | `debt` src/core/quick.ts:118-131 (`quick_money_account`, `quick_debt_account`) | test: debt: lend, borrow, collect, repay move the right sides |
| QUICK-011 | quick-entry | `debt` src/core/quick.ts:125 (`quick_amount_required`) | test: debt: lend, borrow, collect, repay move the right sides |
| QUICK-012 | quick-entry | `debt` src/core/quick.ts:129-130 | test: debt: the Rehber contact rides on the debt line only |
| QUICK-013 | quick-entry | `split` src/core/quick.ts:81-90; `pair` src/core/quick.ts:160-170 | test: transfer: ATM with fee, card payment, and across currencies |
| MEMBER-001 | members-and-pin | API `setup.run` src/core/api/settings.ts:24-44 (`member_name_taken`); `setupStatements` src/core/setup.ts:43-49 | test: members: setup adds them, admin manages, a member edits only own name and own entries |
| MEMBER-002 | members-and-pin | triggers `actors_insert_role` src/core/migrations/0007_audit_columns.sql:393-400 (`member_role_missing`, `actor_role_invalid`) and `actors_update_role` :402-406 (`actor_kind_fixed`, `member_role_missing`) | test: NONE |
| MEMBER-003 | members-and-pin | API `members.add` src/core/api/members.ts:28-36 (`admin_only`, `member_name_taken`); trigger `actors_insert_role` src/core/migrations/0007_audit_columns.sql:398 (`admin_only`) | test: members: setup adds them, admin manages, a member edits only own name and own entries |
| MEMBER-004 | members-and-pin | API `members.update` src/core/api/members.ts:39-51 (`admin_only`, `member_name_taken`, `member_not_found`); trigger `actors_update_role` src/core/migrations/0007_audit_columns.sql:407-409 | test: members: setup adds them, admin manages, a member edits only own name and own entries |
| MEMBER-005 | members-and-pin | trigger `actors_last_admin` src/core/migrations/0007_audit_columns.sql:413-416 (`last_admin`) | test: members: setup adds them, admin manages, a member edits only own name and own entries |
| MEMBER-006 | members-and-pin | API `needOwner` src/core/api/entries.ts:142-145 (`entry_not_owner`); trigger `entries_owner` src/core/migrations/0007_audit_columns.sql:418-421 | test: members: setup adds them, admin manages, a member edits only own name and own entries |
| MEMBER-007 | members-and-pin | API `settings.update` src/core/api/settings.ts:95-97 (`admin_only`); trigger `settings_admin` src/core/migrations/0007_audit_columns.sql:442-444 | test: members: setup adds them, admin manages, a member edits only own name and own entries |
| MEMBER-008 | members-and-pin | read ops carry no role check (src/core/api/ctx.ts:27-28; src/core/api/index.ts:112-133) | test: members: setup adds them, admin manages, a member edits only own name and own entries |
| MEMBER-009 | members-and-pin | `openOps` src/core/api/index.ts:64; gate src/core/api/index.ts:115 (`locked`, `not_setup`) | test: pin: locked gate lets only the open ops through; sign in binds, lock clears |
| MEMBER-010 | members-and-pin | `anyMember` src/core/api/index.ts:104-106; gate :115 | test: pin: before setup the gate says not_setup, not locked |
| MEMBER-011 | members-and-pin | `openOps` src/core/api/index.ts:64 | test: only the expected write ops run without a signed-in member |
| MEMBER-012 | members-and-pin | API `members.signIn` src/core/api/members.ts:90-101 (`member_not_found`, `pin_not_set`, `pin_wrong`); `lock` src/core/api/index.ts:94-96; `pin` input src/core/api/ctx.ts:38 (`invalid_input`) | test: pin: locked gate lets only the open ops through; sign in binds, lock clears |
| MEMBER-013 | members-and-pin | `checkWait`/`wrongPin` src/core/api/members.ts:54-84 (`pin_wrong`, `pin_wait`) | test: pin: 5 wrong tries wait 30 s, restart keeps it, recovery after the wait, success clears |
| MEMBER-014 | members-and-pin | `wrongPin` separate batch src/core/api/members.ts:77-82; `selfLog` src/core/api/ctx.ts:22-31 | test: pin: 5 wrong tries wait 30 s, restart keeps it, recovery after the wait, success clears |
| MEMBER-015 | members-and-pin | API `members.setPin` src/core/api/members.ts:108-129 (`pin_not_own`, `pin_current_required`, `pin_wrong`, `pin_wait`) | test: pin: setPin sets the first PIN freely, a change needs the current PIN and shares the wait counter |
| MEMBER-016 | members-and-pin | API `members.resetPin` src/core/api/members.ts:132-143 (`admin_only`, `pin_reset_self`, `member_not_found`) | test: pin: admin resets another member, not self; a member cannot reset |
| MEMBER-017 | members-and-pin | API `members.resetPin` src/core/api/members.ts:136-141 | test: pin: reset clears the wait counter with the row |
| MEMBER-018 | members-and-pin | `hashPin` PBKDF2-SHA256, 200,000 iterations, 16-byte salt src/core/pin.ts:5-23; no audit trigger on `member_pins` src/core/migrations/0012_member_pins.sql:1-4 | test: pin: setup stores the first admin PIN with the hash, never in audit_log; setup binds the admin |
| MEMBER-019 | members-and-pin | API `setup.run` src/core/api/settings.ts:34-42 | test: pin: setup stores the first admin PIN with the hash, never in audit_log; setup binds the admin |
| MEMBER-020 | members-and-pin | unique index `member_pins_member` src/core/migrations/0012_member_pins.sql:24 (`pin_exists`, src/core/api/errors.ts:21); triggers :26-44 (`no_delete`, `member_not_found`, `row_deleted`) | test: pin: setPin sets the first PIN freely, a change needs the current PIN and shares the wait counter |
| MEMBER-021 | members-and-pin | `verifyPin` src/core/pin.ts:25-30 | test: NONE |
| MEMBER-022 | members-and-pin | src/core/migrations/0012_member_pins.sql:1-4 | test: pin: migration 0012 on a file with members and no PINs leaves them unset |
| FX-001 | fx-rates | API `resolve` src/core/api/entries.ts:58-65 (`rate_missing`); `rateOn` src/core/api/fx.ts:19-25 | test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate |
| FX-002 | fx-rates | API `resolve` src/core/api/entries.ts:67; `rateOf` src/core/money.ts:16-25 | test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate |
| FX-003 | fx-rates | API `fx.get` src/core/api/fx.ts:17-25 | test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate |
| FX-004 | fx-rates | API `fx.set` src/core/api/fx.ts:28-39 | test: fx.set on an existing date updates the rate instead of adding a row |
| FX-005 | fx-rates | API `fx.set` src/core/api/fx.ts:30-31 (`fx_base_currency`, `currency_unknown`) | test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate |
| FX-006 | fx-rates | API `rate` src/core/api/ctx.ts:42 (`invalid_input`); CHECK on `fx_rates.rate` src/core/migrations/0007_audit_columns.sql:126-129 and `lines.rate` :215-220 | test: amounts: integers only, nonzero, same sign; base and rate follow the account currency |
| FX-007 | fx-rates | unique index `fx_rates_currency_date` src/core/migrations/0007_audit_columns.sql:136; mapped to `fx_rate_exists` src/core/api/errors.ts:17 | test: fx.set on an existing date updates the rate instead of adding a row |
| FX-008 | fx-rates | API `fx.delete` src/core/api/fx.ts:41-45 (`fx_rate_not_found`); triggers src/core/migrations/0007_audit_columns.sql:425-427 (`no_delete`, `row_deleted`) | test: fx.list returns live rates newest first, filtered by currency; remove hides a rate |
| FX-009 | fx-rates | API `fx.list` src/core/api/fx.ts:7-15 | test: fx.list returns live rates newest first, filtered by currency; remove hides a rate |
| FX-010 | fx-rates | `toBase` src/core/money.ts:7-13, `divRound` :27-31 | test: toBase converts minor units and rounds half away from zero |
| FX-011 | fx-rates | `rateOf` src/core/money.ts:16-25 | test: rateOf gives back the rate of two amounts |
| FX-012 | fx-rates | triggers `settings_insert` src/core/migrations/0007_audit_columns.sql:429-431 (`currency_unknown`) and `settings_update` :437 (`base_currency_fixed`) | test: base currency is fixed |
| FX-013 | fx-rates | API src/core/api/settings.ts:27 (`currency_unknown`); trigger `settings_insert` src/core/migrations/0007_audit_columns.sql:429-431 | test: setup rejects an unknown base currency |
| FX-014 | fx-rates | API `currencies.list` src/core/api/settings.ts:119-122; open op src/core/api/index.ts:64; data src/core/migrations/0002_currencies.sql | test: before setup only setup.run and currencies.list work; setup runs once |
| FX-015 | fx-rates | triggers `currencies_no_update` src/core/migrations/0007_audit_columns.sql:244 (`currency_fixed`) and `currencies_no_delete` :234 (`no_delete`) | test: no table allows DELETE |
| FX-016 | fx-rates | `fx.set`/`fx.delete` write only `fx_rates` src/core/api/fx.ts:28-45; posted lines are frozen src/core/migrations/0007_audit_columns.sql:375-376 | test: NONE |
| CONTACT-001 | contacts | API `contacts.create` src/core/api/contacts.ts:85-103; trigger `contacts_insert` src/core/migrations/0008_contacts.sql:44-57 | test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked |
| CONTACT-002 | contacts | unique index `contacts_name` on lower(name) src/core/migrations/0008_contacts.sql:22; mapped to `contact_name_taken` src/core/api/errors.ts:18 | test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked |
| CONTACT-003 | contacts | API `checkPartners` src/core/api/contacts.ts:62-70 (`contact_link_kind`); trigger `brand_businesses_insert` src/core/migrations/0008_contacts.sql:86-95 | test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked |
| CONTACT-004 | contacts | API `contacts.update` src/core/api/contacts.ts:118-133 | test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked |
| CONTACT-005 | contacts | unique index `brand_businesses_pair` src/core/migrations/0008_contacts.sql:37; mapped to `contact_link_exists` src/core/api/errors.ts:19 | test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked |
| CONTACT-006 | contacts | trigger `brand_businesses_update` src/core/migrations/0008_contacts.sql:97-103 (`contact_link_fixed`, `row_deleted`) | test: NONE |
| CONTACT-007 | contacts | trigger `contacts_update` src/core/migrations/0008_contacts.sql:63 (`contact_kind_fixed`) | test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked |
| CONTACT-008 | contacts | API `checkAccounts` src/core/api/contacts.ts:72-78 (`account_not_found`, `contact_account_type`); triggers `contacts_insert`/`contacts_update` src/core/migrations/0008_contacts.sql:48-55, 64-73 | test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked |
| CONTACT-009 | contacts | API `contacts.delete` src/core/api/contacts.ts:140-144 (`contact_not_found`); trigger `contacts_soft_delete` src/core/migrations/0008_contacts.sql:78-84; `contacts_no_delete` :40 | test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked |
| CONTACT-010 | contacts | trigger `contacts_has_lines` src/core/migrations/0009_line_contacts.sql:16-21 (`contact_has_lines`) | test: contact on a debt line: balances per contact, a used contact cannot be removed, the line keeps it on edit |
| CONTACT-011 | contacts | trigger `contacts_update` src/core/migrations/0008_contacts.sql:62 (`row_deleted`) | test: NONE |
| CONTACT-012 | contacts | API `contacts.balances` src/core/api/contacts.ts:39-54 | test: contact on a debt line: balances per contact, a used contact cannot be removed, the line keeps it on edit |
| CONTACT-013 | contacts | API `contacts.list` src/core/api/contacts.ts:19-31 | test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked |
| REPORT-001 | reports | API `reports.trialBalance` src/core/api/reports.ts:35-51 | test: reports: trial balance totals match, balance sheet closes with earnings, income statement by period |
| REPORT-002 | reports | API `reports.balanceSheet` src/core/api/reports.ts:57-62 | test: reports: trial balance totals match, balance sheet closes with earnings, income statement by period |
| REPORT-003 | reports | API `reports.incomeStatement` src/core/api/reports.ts:65-68 | test: reports: trial balance totals match, balance sheet closes with earnings, income statement by period |
| REPORT-004 | reports | sums of `base_amount` src/core/api/reports.ts:16-24, 38-41 | test: reports: trial balance totals match, balance sheet closes with earnings, income statement by period |
| REPORT-005 | reports | `LINE_OWNER` src/core/api/reports.ts:9; `ownerSql` src/core/api/ctx.ts:48-51 | test: account owner: Aile, Kişi and Ortak filter reports and the journal |
| REPORT-006 | reports | `LINE_OWNER` src/core/api/reports.ts:9 | test: line member: a line belongs to its member, else to its account owner |
| REPORT-007 | reports | `HAVING balance <> 0` src/core/api/reports.ts:20 | test: NONE |
| REPORT-008 | reports | index `lines_account` src/core/migrations/0007_audit_columns.sql:229 | test: balance query reads only the covering index |
| AUDIT-001 | audit-and-logs | `*_no_delete` triggers src/core/migrations/0007_audit_columns.sql:234-242, 423-425; 0008_contacts.sql:40-41; 0012_member_pins.sql:26; `audit_log_no_delete` 0005_drop_uid.sql:204; `activity_log_prune` 0005_drop_uid.sql:212-218 (`no_delete`, `log_immutable`) | test: no table allows DELETE |
| AUDIT-002 | audit-and-logs | `*_audit_insert`/`*_audit_update` triggers: actors, settings, fx_rates, entries src/core/migrations/0007_audit_columns.sql:446-722; accounts 0010_account_owner.sql:29-90; lines 0011_line_member.sql:20-85; contacts, brand_businesses 0008_contacts.sql:105-195 | test: audit_log records every write with its actor and cannot change |
| AUDIT-003 | audit-and-logs | triggers `audit_log_no_update`/`audit_log_no_delete` src/core/migrations/0005_drop_uid.sql:204, 208 (`log_immutable`) | test: audit_log records every write with its actor and cannot change |
| AUDIT-004 | audit-and-logs | `ctx.write` src/core/api/index.ts:124-131 | test: activity_log records writes and failures; audit.forRow shows row history |
| AUDIT-005 | audit-and-logs | `run` catch src/core/api/index.ts:134-143 | test: activity_log records writes and failures; audit.forRow shows row history |
| AUDIT-006 | audit-and-logs | triggers `activity_log_no_update` src/core/migrations/0005_drop_uid.sql:210 and `activity_log_prune` :212-218 (`log_immutable`) | test: activity_log rows are pruned only after activity_log_days |
| AUDIT-007 | audit-and-logs | `pruneActivityLog` src/core/migrate.ts:17-23; called after migrate in src/ui/lib/api.ts:19 | test: pruneActivityLog drops only rows older than activity_log_days |
| AUDIT-008 | audit-and-logs | default '365' src/core/setup.ts:58; API min 1 src/core/api/settings.ts:88; CHECK digits only src/core/migrations/0007_audit_columns.sql:104 | test: before setup only setup.run and currencies.list work; setup runs once |
| AUDIT-009 | audit-and-logs | API `activity.list` src/core/api/logs.ts:5-21 | test: activity_log records writes and failures; audit.forRow shows row history |
| AUDIT-010 | audit-and-logs | API `audit.forRow` src/core/api/logs.ts:26-39 (`row_not_found`) | test: activity_log records writes and failures; audit.forRow shows row history |
| AUDIT-011 | audit-and-logs | table definitions src/core/migrations/0007_audit_columns.sql:51-224; CHECK `(deleted_at IS NULL) = (deleted_by IS NULL)` | test: every table but the logs has the six audit columns; deleted_by pairs with deleted_at |
| AUDIT-012 | audit-and-logs | trigger `settings_update` src/core/migrations/0007_audit_columns.sql:433-440 (`setting_key_fixed`, `no_delete`) | test: every table but the logs has the six audit columns; deleted_by pairs with deleted_at |
| AUDIT-013 | audit-and-logs | `ctx.now` src/core/api/index.ts:82, 122; `update` src/core/api/ctx.ts:83-87 | test: entries.update and entries.delete stamp the injected clock |
| AUDIT-014 | audit-and-logs | `run` src/core/api/index.ts:114-117 (`unknown_op`, `invalid_input`) | test: bad input fails with invalid_input and an unknown op with unknown_op |
| AUDIT-015 | audit-and-logs | `toApiError` src/core/api/errors.ts:36-45; code lists :3-22 | test: entries: post, number, balances, and database rules as codes |
| AUDIT-016 | audit-and-logs | `migrate` src/core/migrate.ts:7-15 | test: migrate applies all files once and sets user_version |
| AUDIT-017 | audit-and-logs | `migrate` src/core/migrate.ts:10 (`database is newer than the app`) | test: migrate refuses a database newer than the app |
| AUDIT-018 | audit-and-logs | `Db.batch` contract src/core/db.ts:11-15 | test: batch rolls back every statement on error |
| AUDIT-019 | audit-and-logs | adapter contract src/core/db.ts:1-2 | test: integers round-trip up to the safe limit and fail above it |
| AUDIT-020 | audit-and-logs | src/core/migrations/0005_drop_uid.sql, 0006_slim_settings_fx.sql | test: 0005 and 0006 keep every row and id when they rebuild tables |
