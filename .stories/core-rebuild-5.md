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
- Done: minimal contact document (name, fixed kind; `create_contact`, `contact`; `line.contact_id` checked by the database and verify; K25 in ADR-0021; `contact_name_taken`, `contact_kind_fixed`). Names compare with `name_key` (case and the Turkish i ignored), accounts too. Mutations on the kind trigger and the i fold caught; total lines 98.2 percent.
- Done: `post_entry` and `edit_entry` take `create_accounts` and `create_contacts` (ids chosen by the caller), checked under the rules of `create_account` and `create_contact` and written with the entry in one transaction; a reused id is a `conflict`. `open_book` also opens the locked system groups `receivable` and `payable` (Borç). Mutations on the pending name check and the pending contact lookup caught.
- Next: the scenario document format and loader (`scenario::pack`), then `scenario_list`/`describe`/`draft` and the four built-in scenarios with golden tests.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
