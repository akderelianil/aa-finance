# Story: CR-1 Schema v1, revisions, projection and verify_projection

**ID:** core-rebuild-2
**Epic:** core-rebuild
**Sprint:** 6
**Status:** in-progress
**Points:** 5

## Context

The data foundation (ADR-0011, ADR-0012): STRICT tables, UUIDv7 ids, immutable revisions, projection with a current pointer, invariant triggers.

## Acceptance Criteria

- [ ] Revisions are immutable; a posted entry sums to exactly zero (trigger on draft to posted)
- [ ] verify_projection rebuilds the projection and finds no drift on the generated 1,000,000-entry file
- [ ] Migration framework with user_version; tests first, 100 percent on the module

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
