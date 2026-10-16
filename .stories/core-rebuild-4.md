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
