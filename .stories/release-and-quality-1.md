# Story: RQ-1 CI matrix, coverage floors, mutation and fuzz jobs

**ID:** release-and-quality-1
**Epic:** release-and-quality
**Sprint:** 6
**Status:** todo
**Points:** 5

## Context

Quality gates from ADR-0018 on Windows, macOS and Ubuntu runners.

## Acceptance Criteria

- [ ] fmt, clippy, tests and coverage floors (80 overall, 100 on money, rules, crypto) run on all three platforms
- [ ] cargo-mutants and cargo-fuzz jobs exist for the money and parser crates
- [ ] verify command and pre-commit hook updated for the new layout

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
