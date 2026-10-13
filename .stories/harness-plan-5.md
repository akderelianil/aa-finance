# Story: Security guardrails and small core fixes

**ID:** harness-plan-5
**Epic:** harness-plan
**Sprint:** 2
**Status:** done
**Points:** 3

## Context

Raise the Security Guardrails score and close two known risks (step 5).

## Acceptance Criteria

- [x] SECURITY.md exists (done) and ECC tool/prompt guard hooks are enabled in .claude/settings.json
- [x] entries.update uses ctx.now() and a test controls the clock
- [x] A test proves a write op added to the open set cannot run as the system actor while locked

## Technical Notes

Agent: ecc:security-reviewer. Refs: entries.ts:125,150; index.ts:120.

## Definition of Done

- [x] Tests written first cover the acceptance criteria
- [x] Code review and verification loop passed
- [x] Code merged to main
