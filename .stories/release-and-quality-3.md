# Story: RQ-3 Release pipeline and update key

**ID:** release-and-quality-3
**Epic:** release-and-quality
**Sprint:** unassigned
**Status:** todo
**Points:** 5

## Context

Installers and updates that clients can trust without OS signing (ADR-0018).

## Acceptance Criteria

- [ ] Reproducible builds with provenance attestations on GitHub Releases
- [ ] An independent Ed25519 or minisign update key pinned in the app; the app refuses an update with a bad signature
- [ ] Key custody and rotation documented; release accounts use hardware 2FA

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
