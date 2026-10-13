# Story: Local quality gate (verify, pre-commit, coverage threshold)

**ID:** harness-plan-1
**Epic:** harness-plan
**Sprint:** unassigned
**Status:** todo
**Points:** 3

## Context

Replaces the missing CI lane locally and keeps every commit green (HARNESS-PLAN step 1).

## Acceptance Criteria

- [ ] `npm run verify` runs test, tsc, lint, cargo test and fails below the coverage threshold
- [ ] A tracked pre-commit hook runs `verify`; a one-line script installs it
- [ ] CI workflow calls `npm run verify` pieces without drift

## Technical Notes

Skills: ecc:verification-loop, /quality-gate. Threshold starts at 90% lines.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
