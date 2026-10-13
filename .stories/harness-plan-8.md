# Story: Correct rules found by spec mining

**ID:** harness-plan-8
**Epic:** harness-plan
**Sprint:** 3
**Status:** done
**Points:** 5

## Context

Owner decisions on docs/backend/specs/FINDINGS.md: user rate wins, members can be removed, contacts.balances covers all depths, CLAUDE.md and older rule docs match the code.

## Acceptance Criteria

- [x] A given `rate` wins over a given `baseAmount`; then `baseAmount`; then the stored rate; else `rate_missing` (code, tests, docs agree)
- [x] `members.remove`: admin only, not self, keeps the last admin, signed-in member and PIN go away, their entries stay
- [x] `contacts.balances` sums receivable/payable lines on every depth of the Receivables and Payables subtrees
- [x] CLAUDE.md has no push clause and no stale statement; pin-gate.md, rules.md, operations.md, specs and RULES-TRACE match the code

## Technical Notes

Findings 1, 4, 7, 8 in FINDINGS.md. Finding 6 (roles on shared data) is harness-plan-9.

## Definition of Done

- [x] Tests written first cover the acceptance criteria
- [x] Code review and verification loop passed
- [x] Code merged to main
