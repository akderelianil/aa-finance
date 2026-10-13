# Story: Local quality gate (verify, pre-commit, coverage threshold)

**ID:** harness-plan-1
**Epic:** harness-plan
**Sprint:** 1
**Status:** done
**Points:** 3

## Context

Replaces the missing CI lane locally and keeps every commit green (HARNESS-PLAN step 1).

## Acceptance Criteria

- [x] `npm run verify` runs test, tsc, lint, cargo test and fails below the coverage threshold
- [x] A tracked pre-commit hook runs `verify`; a one-line script installs it
- [x] CI workflow calls `npm run verify` pieces without drift

## Technical Notes

Skills: ecc:verification-loop, /quality-gate. Threshold starts at 90% lines.

## Definition of Done

- [x] Tests written first cover the acceptance criteria
- [x] Code review and verification loop passed
- [x] Code merged to main
