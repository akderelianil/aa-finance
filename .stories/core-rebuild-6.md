# Story: CR-5 Reports: Balance Sheet, Income Statement, simple Cash Flow

**ID:** core-rebuild-6
**Epic:** core-rebuild
**Sprint:** unassigned
**Status:** todo
**Points:** 5

## Context

The three v1 reports with virtual valuation at the latest price and a plain info text (ADR-0010).

## Acceptance Criteria

- [ ] Reports reconcile with the ledger on the 1,000,000-entry file; sums never use total()
- [ ] Multi-currency valuation shows the unrealized part as a separate computed line
- [ ] Display in another unit (USD, EUR, gold): flows are valued at the rate of each entry's date, balances at the latest price; a missing day uses the nearest earlier rate and the report says which dates were estimated; a user-given rate always wins
- [ ] Spec requirements for reports mapped to new tests

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
