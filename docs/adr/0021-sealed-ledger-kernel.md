# ADR-0021: Sealed ledger kernel, the invariants that never bend

**Date**: 2026-10-17
**Status**: accepted (owner confirmed the list K1 to K21 on 2026-10-17; K22 was added the same day with the settings document, [ADR-0022](0022-book-settings-document.md); K19 and K20 were built and K23 added on 2026-10-17)
**Deciders**: product owner (core-rebuild-4 talk)

**Relation**: Collects rules that [ADR-0004](0004-balance-by-base-amount-trigger.md), [ADR-0010](0010-amounts-commodities-balancing.md) and [ADR-0012](0012-revisions-as-truth.md) state in prose. It adds no new storage; it makes each rule one row with its enforcement and its test.

## Context
Quality order puts data integrity first. The rules that protect it were spread over three ADRs and the schema, so nobody could answer "is every invariant enforced, and by what?" without reading all of them. New operations (delete, undo, settings, system accounts) will touch the same rules.

## Decision
The kernel is the set of rows below. A row is only "sealed" when the database (or the single Rust function that writes revisions) refuses the violation, a stable code names it, and a test proves the refusal. Rust-only checks are allowed for rules the database cannot see (rates, parsing), and then say so. A new operation may not weaken a row; changing a row needs a new ADR that supersedes this one. Tests are anchored by name so the generated test catalog can be checked against this table.

### Sealed today
| # | Invariant | Enforced by | Code | Test (file: name) |
|---|---|---|---|---|
| K1 | A posted entry has at least two lines | trigger on status change and on every line change; `verify_projection` | `entry_too_few_lines` | store/entries.rs: `a_posted_entry_needs_two_lines`; store/verify.rs: `verify_projection_reports_a_posted_entry_with_one_line_even_when_it_sums_to_zero` |
| K2 | A posted entry sums to exactly zero in base value, no tolerance | same triggers; `verify_projection` | `entry_unbalanced` | store/entries.rs: `an_unbalanced_posted_entry_is_refused_and_nothing_is_stored`, `an_entry_that_is_one_unit_off_is_unbalanced`, `a_faulty_writer_cannot_unbalance_a_posted_entry` |
| K3 | Balance is measured on base value, never on quantity | schema column `base_value` | `entry_unbalanced` | store/entries.rs: `a_posted_entry_balances_on_base_value_not_on_quantity` |
| K4 | A revision is append-only: no update, no delete, every column | triggers on `revision` | `revision_immutable` | store/revisions.rs: `a_revision_cannot_be_changed_or_deleted`, `every_column_of_a_revision_is_immutable` |
| K5 | A local write continues the current head; a stale parent is a conflict | revision writer | `conflict`, `revision_parent_mismatch` | store/revisions.rs (parent mismatch), store/conflicts.rs |
| K6 | All revisions of a document share one kind | trigger | `revision_kind_mismatch` | store/revisions.rs (kind mismatch) |
| K7 | Only the projector writes projection tables | triggers and the projection session | `projection_closed` | store/verify.rs: `only_the_projector_writes_projection_tables`, `the_projection_session_cannot_be_removed_or_replaced_to_open_the_gates` |
| K8 | Amounts are scaled integers inside ±2^62, never float | `CHECK` on `quantity` and `base_value`; checked arithmetic | `amount_out_of_range` | store/validation.rs: `a_duplicate_commodity_code_scale_range_and_amount_bound_have_codes`; amount tests |
| K9 | A line is never empty and quantity and base agree in sign | `CHECK` constraints | `line_empty`, `line_base_sign` | store/entries.rs (both), ops/entries.rs |
| K10 | The scale of a commodity is 0 to 18 and cannot change once a line uses it | `CHECK`; trigger | `commodity_scale_invalid`, `commodity_scale_locked` | store/accounts.rs: `the_scale_of_a_commodity_in_use_cannot_change` |
| K11 | A line uses the commodity of its account; an account in use cannot change commodity | triggers | `line_commodity_mismatch`, `account_commodity_locked` | store/accounts.rs: `a_line_must_use_the_commodity_of_its_account`, `the_commodity_of_an_account_in_use_cannot_change` |
| K12 | An archived account takes no new lines (an unchanged carried line may stay) | trigger with the carry flag | `account_archived` | store/accounts.rs: `an_archived_account_takes_no_new_lines`, `an_old_entry_on_an_archived_account_can_still_be_corrected` |
| K13 | The account tree has no cycle | projector | `account_parent_cycle` | store/accounts.rs (three cases) |
| K14 | A date is a real civil Gregorian `YYYY-MM-DD` | `CHECK` | `date_invalid` | ops/entries.rs |
| K15 | A given rate and a given base must agree | Rust (database cannot see rates) | `rate_base_conflict` | ops/entries.rs |
| K16 | The projection can always be rebuilt from revisions and compared | `rebuild_projection`, `verify_projection` | (report) | store/rebuild.rs: `a_rebuild_reproduces_the_incremental_projection_exactly`; store/verify.rs |
| K17 | An entry row starts as a draft and becomes posted only through the balance check | trigger on insert | `entry_must_start_as_draft` | store/entries.rs: `an_entry_cannot_be_inserted_as_posted_without_its_lines` |
| K18 | A commodity code is used once | `UNIQUE` | `commodity_code_taken` | store/validation.rs: `a_duplicate_commodity_code_scale_range_and_amount_bound_have_codes` |
| K19 | Nothing is hard-deleted; delete is a `deleted` status (a tombstone revision keeps the lines), and a deleted entry has no lines in the projection, so no balance or report counts it; undo restores it | status `deleted`; triggers on `entry.status` and on `line` insert | `entry_deleted_has_lines` | store/entries.rs: `a_deleted_entry_keeps_no_lines_in_the_projection`, `a_restored_entry_gets_its_lines_back_and_a_rebuild_agrees`, `a_deleted_entry_row_cannot_hold_lines`; ops/entries.rs: `deleting_an_entry_keeps_its_revisions_and_marks_it_deleted`, `undoing_a_delete_brings_the_entry_back` |
| K20 | The Rounding account is opened and locked by the system; a locked account keeps every field it was opened with and cannot be undone | `locked` and `system_key` as account data; trigger on `account`; operations refuse first | `account_locked` | store/accounts.rs: `a_locked_account_cannot_be_renamed_archived_or_unlocked`, `a_locked_account_survives_a_rebuild_and_verifies_clean`; ops/accounts.rs: `a_locked_account_is_refused_a_rename_an_archive_and_an_undo`, `opening_a_book_opens_a_locked_rounding_account` |
| K21 | The base currency is fixed once any entry has a revision (a draft counts); it can change before that | trigger on `settings.base_commodity_id` | `base_currency_locked` | store/settings.rs: `the_base_currency_is_locked_once_an_entry_exists`, `a_draft_entry_locks_the_base_currency_too`, `a_refused_base_change_leaves_the_settings_as_they_were`; ops/settings.rs: `the_base_currency_is_locked_by_the_first_entry` |
| K22 | A book has one settings document, under one fixed id; its row is written only by the projector | Rust check in the projector; `CHECK (id = 1)`; projection gate | `settings_id_fixed`, `projection_closed` | store/settings.rs: `settings_under_any_other_document_id_are_refused`, `only_the_projector_writes_the_settings_table` |
| K23 | A system key belongs to one account | `UNIQUE` on `account.system_key` | `system_key_taken` | store/accounts.rs: `a_system_key_belongs_to_one_account` |

K21, K22 and K23 keep the numbers they had when they were planned, so references in the story and the notes stay valid.

### Refusals of input, not invariants
These codes stop bad input at the boundary in Rust, before anything is stored: `amount_invalid`, `amount_too_precise`, `rate_invalid`, `rate_missing`, `nothing_to_undo`, `book_already_open` (a book is opened once), `name_empty`, `account_parent_archived`, `account_parent_kind_mismatch` and `account_name_taken` (case ignored, per parent) and `entry_deleted` (a deleted entry is neither edited nor deleted again; undo first). The database never sees them, so they are not rows above. They are listed so that every rule code appears in this ADR; the check below fails otherwise.

### Found while writing this table
- **Commodities have no archived state.** ADR-0012 says "archived commodities and accounts take no new lines". Only accounts archive. A commodity is never deleted, and to stop using one the user archives its accounts; the UI can hide a commodity that has no active account. Decision (2026-10-17): correct ADR-0012 (done there); no commodity archive in v1.
- **The draft-start trigger used the wrong code.** It raised `entry_unbalanced` for a non-draft insert. Fixed on 2026-10-17: it raises `entry_must_start_as_draft` (K17).
- **K5 and K6 test names are not listed above** because their tests are inline assertions in a larger test; give them their own names when the story touches them.

### The check
`npm run kernel:check` (part of `npm run verify`) fails when a rule code of `RuleCode::as_str` is missing from this file, or when a test named after a file here (`file.rs: \`name\``) no longer exists in the Rust sources. Rename a test and the commit stops until this table is updated.

## Alternatives Considered
### Prose list in one ADR
- **Pros**: easy to write
- **Cons**: cannot be checked; drifts
- **Why not**: the owner chose a table, and a table row maps to a code and a test.

### Generate the table from code
- **Pros**: never drifts
- **Cons**: the reasons and the "decided, not sealed" rows are not in code
- **Why not**: keep this hand-written for now; a check that every code in `RuleCode` appears in a row is cheap and can go into `npm run verify`.

## Consequences
### Positive
- One place answers "what can never happen, and what stops it".
- Gaps are visible (K19 and K20).
### Negative
- A row has to be edited when a test is renamed.
### Risks
- The table is hand-kept. Mitigation: `npm run kernel:check` fails on a missing code or a vanished test. It does not prove that a row's text is true; reviewers read the table when they touch a rule.
