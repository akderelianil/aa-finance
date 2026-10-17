# Story: CR-3 Accounts, entries and the named-operation API

**ID:** core-rebuild-4
**Epic:** core-rebuild
**Sprint:** 7
**Status:** todo
**Points:** 8

## Context

Ledger operations as revisions (ADR-0012, ADR-0008): chart with locked roots, archive, entries post, edit, undo, locks, activity history, a versioned JSON API with stable error codes.

## Acceptance Criteria

- [ ] Accounts and entries as revisions with undo (the lock date was dropped from v1, 2026-10-16); conflict branch and needs-attention states in the model
- [ ] API reference generated from code; every error code has Turkish and English text
- [ ] Amounts and rates cross the API as canonical strings (parse_amount, format_amount, Rate::parse; ADR-0009), with a test through the API layer
- [ ] Spec requirements for accounts and ledger entries mapped to new tests

## Technical Notes

Decisions: docs/adr/0008 to 0020. Dependencies: docs/foundation/migration-plan.md.

Hand-offs from the core-rebuild-2 and -3 reviews (2026-10-14): typed ids (document, revision) and a typed revision body before the operations are written; a public mapping from Error to a stable code and a safe message (no SQLite text over the API); the operation layer stamps author and time; a guard that the test-support feature is absent from shipped crates. The store-side items are in core-rebuild-11.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main

## Progress (2026-10-16)

Slice 1 done: `ops::Ledger` with commodity, account and entry operations, undo, history (commits d718b49 and the review fixes). Open from the independent review, to do in this story:
- Undo is a one-step toggle; decide the semantics for repeated undo (a `restored_from` link or a walk back) before the UI relies on it.
- Base currency is per session; store it as a settings revision and let `entry()` read the scale the entry was written with.
- Rounding line for foreign conversions; the rate is not stored on a line (decide if it must be).
- Input rules: empty names and codes, archived or mismatched parent, draft status on edit.
- `history()` should mark the head and conflict branches; views need docs.
- Also still open: entry delete (tombstone), root accounts, API reference. (Lock date dropped; typed ids done on 2026-10-17.)

## Decisions (owner, 2026-10-16)
1. Undo: B, a `restored_from` link; repeated undo walks back, redo is a separate explicit operation.
2. Delete: a `deleted` status on the entry (tombstone revision keeps the lines in its body; the projection drops the lines). v1 has only "undo the last action", no trash view.
3. One settings document (revisioned). Base currency is fixed per book (decided 2026-10-17): the settings refuse a change once the first entry exists, with a stable error code. No base periods and no `base` on entries; moving countries is the later "carry over as a new book" feature (docs/foundation/backlog.md).
4. Store the rate on the line (optional field). 5. The system opens and locks the Rounding account. 6. `locked` and `system_key` on accounts, as data so new system accounts need no code change. 7. Reject empty names and codes, archived parent, parent of another kind, duplicate sibling names. 9. Typed ids `DocId`, `RevisionId` now. 10. Drafts are not user-visible in v1; edit keeps the entry status. 11. API reference generated from an operation registry (name, version, input/output schema, error codes).
8. The period lock date is dropped from v1 (an idea for later with several members and reconciliation; the settings document may gain an optional `lock_date`, one check point in `Ledger`). Noted in ADR-0012 and docs/foundation/backlog.md.
Both talks are closed: the base currency (3) and the sealed ledger kernel (ADR-0021, accepted 2026-10-17).
Order: ~~typed ids~~, settings, rate on line, account fields and system accounts, input rules, delete, undo, API reference.

## Progress (2026-10-17)
- ADR-0021 accepted: the sealed kernel as a table K1 to K21 (invariant, enforcement, stable code, test). K1 to K18 are sealed today; K19 (delete), K20 (locked system accounts) and K21 (base currency locked after the first entry) are built in this story and move into the sealed table when done. `npm run kernel:check` (part of `npm run verify`) fails when a rule code is missing from the ADR or a test it names no longer exists.
- Fixed: a non-draft entry insert raised `entry_unbalanced`; it now raises `entry_must_start_as_draft` (K17). Commodities have no archived state (ADR-0012 corrected; accounts archive instead).
- Typed ids done (commit ad3e285): `DocId` and `RevisionId` replace the bare `Id` for documents and revisions; the author stays a raw `Id` until the member type exists. A `compile_fail` doctest proves the two cannot be mixed.
- Base currency decided: fixed per book, locked after the first entry; moving countries is the later "carry over as a new book" feature, display in USD, EUR or gold is virtual (backlog; the date-based rate lookup is an acceptance criterion of core-rebuild-6).
- Settings document done (ADR-0022): `open_book`, `settings`, `set_base_currency`; fixed document id, one projection row with the base currency as a column, the rest of the settings in the JSON body; the base currency is locked once any entry has a revision (K21, sealed; mutation checked). `Ledger` no longer holds a session base currency. Book settings are admin-only: the check is an acceptance criterion of core-rebuild-7 and goes into the one write path.
- Rate on line done: `LineBody.rate` (canonical text, optional) holds the given rate, or the rate implied by a given base; base-currency lines keep none. It lives in the body only (no rule reads it), so the projection check compares lines without it; `LineView.rate` shows it. A stored rate from the price history (`stored_rate`) joins in core-rebuild-6.
- Account fields and system accounts done (K20 sealed, K23 added): `locked` and `system_key` on accounts (columns, trigger `account_locked`, unique key `system_key_taken`); `open_book` also opens the locked Rounding account (expense kind, base currency); `Ledger::system_account(key)`; rename, archive and undo of a locked account are refused. Entries now get a Rounding line when conversions leave a difference of up to one base unit per converted line (`rounding_line`); more is `entry_unbalanced`.
- Input rules done (refusals in `Ledger`, listed in ADR-0021): blank account name or commodity code `name_empty`, archived parent, parent of another kind, duplicate sibling name (case ignored, own name allowed on rename). Draft status on edit needs no work: drafts are not user-visible in v1 and an edit posts.
- Next: delete (K19), undo, API reference.
- Counts: 77 unit, 50 operation and 91 store tests, 1 doctest, 15 script tests.
