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
- [ ] Only the admin changes the book settings (ADR-0022): the check goes into `Ledger::set_base_currency`, the one write path of the settings document, with a test for a non-admin member; person and device settings stay outside the ledger and are open to every member
- [ ] The PIN gate is documented as a gate, with the shared-computer warning text
- [ ] Findings 11 and 12 of the prototype are closed by the single core boundary

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
