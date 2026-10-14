# Story: RQ-5 Freeze the deterministic form of a revision body

**ID:** release-and-quality-5
**Epic:** release-and-quality
**Sprint:** unassigned
**Status:** todo
**Points:** 3

## Context

A revision body is stored as JSON text today (owner decision 2026-10-14: JSON for now, freeze before the first release). Signing and sync need the same bytes on every device, and JSON can write one value in several ways (key order, spacing, number form). Before the first release the form must be fixed, because afterwards every stored revision would have to be rewritten and its hash would change. Options to weigh: canonical JSON (RFC 8785), which keeps the body readable, or deterministic CBOR (RFC 8949 section 4.2), as ADR-0014 and the testing options assume.

## Acceptance Criteria

- [ ] One deterministic encoding is chosen in an ADR (canonical JSON or deterministic CBOR) with the reasons and the migration of existing bodies
- [ ] The core writes revision bodies only in that form; reading a body in another form is refused or normalised, never stored
- [ ] Golden files prove that the same value always gives the same bytes and the same hash on all three platforms

## Technical Notes

Dependencies: core-rebuild-2 (revision store), ADR-0012, ADR-0014. Must be done before the first release and before any signature or sync work starts. Rebuild migrations freeze at the first release (see CLAUDE.md), so this cannot wait until after it.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
