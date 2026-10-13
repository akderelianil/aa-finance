# Story: CR-9 Command line quick entry

**ID:** core-rebuild-10
**Epic:** core-rebuild
**Sprint:** unassigned
**Status:** todo
**Points:** 3

## Context

Early pick (CLI beside the UI): a separate binary that links the core, uses a local token bound to a member, and writes through the same API.

## Acceptance Criteria

- [ ] cli add expense/income/transfer/debt works from a terminal and from a script
- [ ] Token creation, revocation and permission limits are tested
- [ ] Two processes writing the same file are safe (BEGIN IMMEDIATE, busy timeout)

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
