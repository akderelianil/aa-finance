# Story: CR-4 Scenario engine and the four v1 scenarios

**ID:** core-rebuild-5
**Epic:** core-rebuild
**Sprint:** 7
**Status:** in-progress
**Points:** 8

## Context

Scenarios as data (ADR-0016): schema, safe expressions, official calculators, preview sentence, and the packs Gider, Gelir, Transfer, Borç.

## Acceptance Criteria

- [x] Expression crate verified (licence, releases) or a minimal grammar chosen, recorded in an ADR note (ADR-0024)
- [ ] Golden tests for each scenario including foreign currency and card payment; a faulty scenario cannot corrupt the books
- [ ] Form description is stable and documented for all platforms to render

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Progress (2026-11-02)

- ADR-0024: own minimal grammar, scenario format, describe/draft API, choice options, minimal contact document, required rate on foreign lines.
- Done: expression module `scenario::expr` (lexer and parser in `expr/parse.rs`, separate amount and boolean trees, checked evaluation); 29 unit tests incl. 3 properties; lines 100 and 98.8 percent; mutations on the commodity check and the depth limit caught.
- Next: the minimal contact document (`create_contact`, line contact id checked by the database), then the scenario document format and loader.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
