# Story: CR-4 Scenario engine and the four v1 scenarios

**ID:** core-rebuild-5
**Epic:** core-rebuild
**Sprint:** 7
**Status:** todo
**Points:** 8

## Context

Scenarios as data (ADR-0016): schema, safe expressions, official calculators, preview sentence, and the packs Gider, Gelir, Transfer, Borç.

## Acceptance Criteria

- [ ] Expression crate verified (licence, releases) or a minimal grammar chosen, recorded in an ADR note
- [ ] Golden tests for each scenario including foreign currency and card payment; a faulty scenario cannot corrupt the books
- [ ] Form description is stable and documented for all platforms to render

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
