# Story: DU-0 Hardened Electron shell, core process and accessibility harness

**ID:** desktop-ui-1
**Epic:** desktop-ui
**Sprint:** unassigned
**Status:** todo
**Points:** 5

## Context

The shell (ADR-0009): Electron with context isolation, sandbox, strict CSP, a minimal preload, the core running in a utility process, and the accessibility test harness.

## Acceptance Criteria

- [ ] Electron hardening checklist enforced by tests; the UI imports no Electron API (lint boundary)
- [ ] Playwright runs on all three CI platforms; axe checks run on every flow
- [ ] Keys and the database never enter the renderer

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
