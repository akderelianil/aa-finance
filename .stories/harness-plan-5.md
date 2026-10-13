# Story: Security guardrails and small core fixes

**ID:** harness-plan-5
**Epic:** harness-plan
**Sprint:** unassigned
**Status:** todo
**Points:** 3

## Context

Raise the Security Guardrails score and close two known risks (step 5).

## Acceptance Criteria

- [ ] SECURITY.md exists (done) and ECC tool/prompt guard hooks are enabled in .claude/settings.json
- [ ] entries.update uses ctx.now() and a test controls the clock
- [ ] A test proves a write op added to the open set cannot run as the system actor while locked

## Technical Notes

Agent: ecc:security-reviewer. Refs: entries.ts:125,150; index.ts:120.

## Definition of Done

- [ ] Tests written first cover the acceptance criteria
- [ ] Code review and verification loop passed
- [ ] Code merged to main
