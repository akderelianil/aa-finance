# Story: CR-2 Amounts, rounding and rates

**ID:** core-rebuild-3
**Epic:** core-rebuild
**Sprint:** 6
**Status:** todo
**Points:** 5

## Context

Exact money (ADR-0010): scaled int64, decimal parsing and formatting, base_value, the Rounding line, user-given rate or base wins, price history table.

## Acceptance Criteria

- [ ] Property tests for rounding, scale and overflow; checked i128 aggregation
- [ ] Decimal parsing for both separator styles and every scale; amounts cross the API as strings
- [ ] Prototype cases for foreign currency, given rate and given base pass in the new suite

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
