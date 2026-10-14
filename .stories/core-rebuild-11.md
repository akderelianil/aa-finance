# Story: CR-10 Sync-ready store: needs-attention state, idempotent import, provenance

**ID:** core-rebuild-11
**Epic:** core-rebuild
**Sprint:** unassigned
**Status:** todo
**Points:** 8

## Context

Open findings of the reviewers on the revision store (core-rebuild-2, 2026-10-14). ADR-0012 promises that a revision which cannot be projected is kept visibly and never dropped; today any projection error rolls the whole transaction back, which loses data on the import path and can block a rebuild. These items must be done before sync work starts and before the conflict model of core-rebuild-4 is final.

## Acceptance Criteria

- [ ] A revision that cannot be projected (archived account, missing reference, body of a newer core) is stored in a visible needs-attention state with its reason; the rest of its batch and the previous head stay in place
- [ ] Importing revisions that are already stored changes nothing, and a child that arrives before its parent waits instead of failing the batch
- [ ] set_server_seq and rebuild_projection do not abort because of one bad document: they report it
- [ ] Imported revisions keep the rules, schema and core version of their origin; conflict branches are checked against the projection rules when they arrive
- [ ] A local edit made while a document is in conflict is refused with a clear code, or keeps the user's branch visible
- [ ] A full rebuild and the incremental projection agree on lines of archived accounts
- [ ] server_seq is unique and positive; verify_projection flags rows that dangle (left joins) and a busy database has its own error

## Technical Notes

Decisions: docs/adr/0012. Dependencies: core-rebuild-4 (the conflict and needs-attention states in the model). Findings: rust-reviewer H1 H2 M2 M4 M10, silent-failure-hunter 1 2 3 4 (store review of 2026-10-14).

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
