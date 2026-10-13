# Story: DU-1 App shell, i18n, tokens and setup flow

**ID:** desktop-ui-2
**Epic:** desktop-ui
**Sprint:** unassigned
**Status:** todo
**Points:** 5

## Context

Navigation, Turkish and English strings, design tokens and the first-run setup (family, country, book currency, first admin).

## Acceptance Criteria

- [ ] Keyboard-only navigation and a visible focus order verified by tests
- [ ] Setup builds a ledger through the API and the core, with the recovery explanation for later sync
- [ ] Number and date format follow the book country

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
