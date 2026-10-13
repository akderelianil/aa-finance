# Story: Component and E2E tests

**ID:** harness-plan-6
**Epic:** harness-plan
**Sprint:** 4
**Status:** done
**Points:** 8

## Context

Cover the UI paths no test reaches today (step 6).

## Acceptance Criteria

- [x] formatLocale moves to a pure module and is tested
- [x] useKept effect is covered by a component test
- [x] A Playwright smoke path passes: setup, PIN, Quick Entry, journal, trial balance

## Technical Notes

Agent: ecc:e2e-runner. Needs a DOM test setup (decide library in the story).

## Definition of Done

- [x] Tests written first cover the acceptance criteria
- [x] Code review and verification loop passed
- [x] Code merged to main
