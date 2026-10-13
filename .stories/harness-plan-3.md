# Story: Behavior specs and rule-to-test trace

**ID:** harness-plan-3
**Epic:** harness-plan
**Sprint:** unassigned
**Status:** todo
**Points:** 5

## Context

Make accounting rules auditable: rule -> trigger -> test (step 3).

## Acceptance Criteria

- [ ] Specs mined from src/core/ live under docs/backend/specs/
- [ ] docs/RULES-TRACE.md maps every Product rule to a trigger code and a test name
- [ ] A test fails when a listed test name no longer exists

## Technical Notes

Agent: ecc:spec-miner. Skills: ecc:contract-first, ecc:context-and-decisions.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
