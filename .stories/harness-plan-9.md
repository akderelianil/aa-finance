# Story: Roles and permissions for shared data

**ID:** harness-plan-9
**Epic:** harness-plan
**Sprint:** 3
**Status:** done
**Points:** 8

## Context

Any member can change accounts, exchange rates and contacts today. The family admin should decide who can see and do what.

## Acceptance Criteria

- [x] Design decided with the owner: admin-only vs per-member grants for accounts, rates, contacts and visibility
- [x] Rules enforced by triggers with stable error codes, and checked first by the API
- [x] UI shows or hides the controls by role; admin manages grants in Settings
- [x] ADR written; specs, RULES-TRACE and ARCHITECTURE updated

## Technical Notes

Finding 6 and 5 in FINDINGS.md. ARCHITECTURE.md lists per-member entry grants as out of v1: revisit that line.

## Definition of Done

- [x] Tests written first cover the acceptance criteria
- [x] Code review and verification loop passed
- [x] Code merged to main
