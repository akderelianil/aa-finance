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
- [ ] Spec requirements for accounts and ledger entries mapped to new tests

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
