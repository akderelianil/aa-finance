# Story: DU-3 Journal and register at scale

**ID:** desktop-ui-4
**Epic:** desktop-ui
**Sprint:** unassigned
**Status:** todo
**Points:** 5

## Context

Lists on the 1,000,000-entry file: paging from SQL, virtualization, search.

## Acceptance Criteria

- [ ] Scrolling and search stay responsive on the fixture; timings are recorded, not gated
- [ ] The virtualized grid is keyboard and screen-reader operable (checked, with a fallback if the ReUI grid fails)
- [ ] Undo and the activity history are reachable from an entry

## Technical Notes

Decisions: docs/adr/0008 to 0019. Dependencies: docs/foundation/migration-plan.md.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
