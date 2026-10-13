# Story: CR-0 Repository move and workspace skeleton

**ID:** core-rebuild-1
**Epic:** core-rebuild
**Sprint:** 6
**Status:** todo
**Points:** 3

## Context

Clear the ground: tag the prototype, move it to legacy/, create the Rust workspace and app folders (ADR-0008, migration plan).

## Acceptance Criteria

- [ ] Tag prototype-final exists; prototype code runs from legacy/ and its tests still pass
- [ ] crates/core builds on Windows, macOS and Ubuntu (cargo check in CI)
- [ ] CLAUDE.md, README and verify scripts describe the new layout

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
