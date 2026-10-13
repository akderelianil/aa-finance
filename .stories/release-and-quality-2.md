# Story: RQ-2 Supply-chain protection

**ID:** release-and-quality-2
**Epic:** release-and-quality
**Sprint:** unassigned
**Status:** todo
**Points:** 3

## Context

Protect a public repository (ADR-0018).

## Acceptance Criteria

- [ ] cargo-deny, cargo-vet, npm ci with no install scripts, dependency review, CodeQL and secret scanning enabled
- [ ] All Actions pinned by SHA; CI secrets minimal and withheld from fork pull requests
- [ ] Dependency update policy documented

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
