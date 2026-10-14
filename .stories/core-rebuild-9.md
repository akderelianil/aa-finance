# Story: CR-8 Spec parity and retire the legacy tree

**ID:** core-rebuild-9
**Epic:** core-rebuild
**Sprint:** unassigned
**Status:** todo
**Points:** 5

## Context

Close the loop: every prototype spec requirement is carried, changed or dropped with a test id; then delete legacy/ (the tag keeps it).

## Acceptance Criteria

- [ ] Trace test passes for the new suite; no spec requirement is unmapped
- [x] legacy/ removed from main (done early on 2026-10-14 by the owner; the tag prototype-final keeps it)
- [ ] docs/RULES-TRACE.md rewritten for the new tests; its trace test (deleted with legacy/) is replaced by a new one

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
