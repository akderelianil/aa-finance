# Story: CR-3 Accounts, entries and the named-operation API

**ID:** core-rebuild-4
**Epic:** core-rebuild
**Sprint:** 7
**Status:** todo
**Points:** 8

## Context

Ledger operations as revisions (ADR-0012, ADR-0008): chart with locked roots, archive, entries post, edit, undo, locks, activity history, a versioned JSON API with stable error codes.

## Acceptance Criteria

- [ ] Accounts and entries as revisions with undo and a lock date; conflict branch and needs-attention states in the model
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
- Also still open: entry delete (tombstone), lock date, root accounts, API reference, typed ids.

## Decisions (owner, 2026-10-16)
1. Undo: B, a `restored_from` link; repeated undo walks back, redo is a separate explicit operation.
2. Delete: a `deleted` status on the entry (tombstone revision keeps the lines in its body; the projection drops the lines). v1 has only "undo the last action", no trash view.
3. One settings document (revisioned). Base currency change (moving countries) is NOT decided: a proposal exists (a list of base periods in the settings, entries belong to a period by date, old values valued virtually) and goes to the next session. Do not build it before that talk.
4. Store the rate on the line (optional field). 5. The system opens and locks the Rounding account. 6. `locked` and `system_key` on accounts, as data so new system accounts need no code change. 7. Reject empty names and codes, archived parent, parent of another kind, duplicate sibling names. 9. Typed ids `DocId`, `RevisionId` now. 10. Drafts are not user-visible in v1; edit keeps the entry status. 11. API reference generated from an operation registry (name, version, input/output schema, error codes).
8. The period lock date is dropped from v1 (an idea for later with several members and reconciliation; the settings document may gain an optional `lock_date`, one check point in `Ledger`). ADR-0012 and docs/foundation/backlog.md still need the note.
Open for the next session: base currency change (3) and a sealed ledger kernel (invariants list as an ADR).
Order: typed ids, settings, rate on line, account fields and system accounts, input rules, delete, undo, API reference.
