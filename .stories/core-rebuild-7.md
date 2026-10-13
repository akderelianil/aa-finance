# Story: CR-6 Members, per-account roles and the device PIN gate

**ID:** core-rebuild-7
**Epic:** core-rebuild
**Sprint:** unassigned
**Status:** todo
**Points:** 8

## Context

Local roles (ADR-0015): permissions member x account x action, admin sees all, own accounts by default, device PIN gate, CLI token concept.

## Acceptance Criteria

- [ ] Visibility and edit rules tested for member, admin, restricted viewer and removed member
- [ ] The PIN gate is documented as a gate, with the shared-computer warning text
- [ ] Findings 11 and 12 of the prototype are closed by the single core boundary

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
