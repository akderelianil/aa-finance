# Story: Generated API and error-code references

**ID:** harness-plan-4
**Epic:** harness-plan
**Sprint:** 2
**Status:** todo
**Points:** 5

## Context

Remove hand-written reference drift (step 4).

## Acceptance Criteria

- [ ] operations.md and an error-code catalog are generated from code
- [ ] A test fails when generated docs differ from the committed files
- [ ] A test fails when an errors.<code> or ops.<op> i18n string is missing in tr or en; the `as never` cast at api.ts:45 is gone

## Technical Notes

Skills: ecc:doc-updater, ecc:docs-governance.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
