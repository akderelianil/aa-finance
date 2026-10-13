# Story: Durable memory and ADRs

**ID:** harness-plan-2
**Epic:** harness-plan
**Sprint:** 1
**Status:** done
**Points:** 3

## Context

Record the architecture decisions that are currently implicit (step 2).

## Acceptance Criteria

- [x] docs/adr/ holds ADRs for: single-writer queue and max(id)+1, PIN as app gate, base_amount balance trigger, soft delete only, manual FX rates
- [x] Each ADR has context, decision, consequences; docs/README.md indexes them
- [x] CLAUDE.md and ARCHITECTURE.md link to the ADRs instead of repeating them

## Technical Notes

Skill: ecc:architecture-decision-records.

## Definition of Done

- [x] Tests written first cover the acceptance criteria
- [x] Code review and verification loop passed
- [x] Code merged to main
