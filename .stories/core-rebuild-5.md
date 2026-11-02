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
- [x] Golden tests for each scenario including foreign currency and card payment; a faulty scenario cannot corrupt the books
- [x] Form description is stable and documented for all platforms to render

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Progress (2026-11-02)

- ADR-0024: own minimal grammar, scenario format, describe/draft API, choice options, minimal contact document, required rate on foreign lines.
- Done: expression module `scenario::expr` (lexer and parser in `expr/parse.rs`, separate amount and boolean trees, checked evaluation); 29 unit tests incl. 3 properties; lines 100 and 98.8 percent; mutations on the commodity check and the depth limit caught.
- Done: minimal contact document (name, fixed kind; `create_contact`, `contact`; `line.contact_id` checked by the database and verify; K25 in ADR-0021; `contact_name_taken`, `contact_kind_fixed`). Names compare with `name_key` (case and the Turkish i ignored), accounts too. Mutations on the kind trigger and the i fold caught; total lines 98.2 percent.
- Done: `post_entry` and `edit_entry` take `create_accounts` and `create_contacts` (ids chosen by the caller), checked under the rules of `create_account` and `create_contact` and written with the entry in one transaction; a reused id is a `conflict`. `open_book` also opens the locked system groups `receivable` and `payable` (Borç). Mutations on the pending name check and the pending contact lookup caught.
- Done: pack format accepted (docs/foundation/scenario-format.md; owner decisions: one payment account per split, `convert: true` on a line, system account `bank_fee`). Loader `scenario::pack` (raw shapes, checker, SHA-256 content hash via `sha2`, MIT/Apache): names, references, field sets per type, choice values, strings in tr and en, preview placeholders and typed expressions are checked at load. 21 unit tests; lines 100, 99.6 and 100 percent; five mutations caught.
- Done: calculators `convert` and `cross_rate` (`scenario::calc`); built-in pack (`scenario/builtin.json`, loaded once); `default_system` on account inputs (Transfer fee defaults to `bank_fee`).
- Done: draft engine `scenario::draft` (reader, builder, preview) behind a `Books` trait; `Ledger::scenario_draft`. Golden tests for Gider (cash, card, split with a new account, dollar card with rate), Gelir (split, new account), Transfer (ATM with fee, card payment, lira to dollars, dollar fee), Borç (four actions, new contact, dollar child under the group, borrow with a negative base) and edges; a faulty pack yields an entry the ledger refuses. A left-out line opens no account. 38 tests; draft lines 95 to 99 percent; mutations on sign, base sign, kind, distinct and default caught.
- Done: `scenario_list`, `scenario_describe` (`scenario::describe`, form without expressions) and `scenario_draft` in the API contract (22 operations) and docs/api/v1.md; a session test drafts, posts and checks every answer against the contract.
- Next: reviewer agents (rust-reviewer, silent-failure-hunter, type-design-analyzer, pr-test-analyzer), fixes, then the story goes to review.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
