# Story: CR-7 Backup, restore, CSV export and erase

**ID:** core-rebuild-8
**Epic:** core-rebuild
**Sprint:** unassigned
**Status:** todo
**Points:** 5

## Context

Data safety (vision principles 1 and 2): automatic verified backups, a full restorable backup, CSV export with a documented schema, cloud-folder refusal, erase paths (ADR-0012).

## Acceptance Criteria

- [ ] A restore test proves a backup reopens and verify_projection is clean
- [ ] CSV files plus schema document cover all user data; round-trip spot checks
- [ ] The live database is refused inside a detected synced folder unless overridden

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
