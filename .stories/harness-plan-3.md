# Story: Behavior specs and rule-to-test trace

**ID:** harness-plan-3
**Epic:** harness-plan
**Sprint:** 3
**Status:** done
**Points:** 5

## Context

Make accounting rules auditable: rule -> trigger -> test (step 3).

## Acceptance Criteria

- [x] Specs mined from src/core/ live under docs/backend/specs/
- [x] docs/RULES-TRACE.md maps every Product rule to a trigger code and a test name
- [x] A test fails when a listed test name no longer exists

## Technical Notes

Agent: ecc:spec-miner. Skills: ecc:contract-first, ecc:context-and-decisions.

## Definition of Done

- [x] Tests written first cover the acceptance criteria
- [x] Code review and verification loop passed
- [x] Code merged to main
