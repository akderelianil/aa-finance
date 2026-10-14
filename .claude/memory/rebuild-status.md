---
name: rebuild-status
description: Where the aa-finance rebuild stands (2026-10-14) and what to do first next session
metadata:
  type: project
---

State on 2026-10-14: foundation-reset is closed and approved. Prototype is frozen in legacy/ (tag prototype-final). Sprint 6: core-rebuild-1 done; core-rebuild-2 (schema v1, revisions, projection, verify_projection) in review; core-rebuild-3 (amounts, rates, rounding line: `crates/core/src/amount.rs`, `rate.rs`) in review, 100 percent line coverage on both files, four reviewer agents run and fixed. Open: release-and-quality-1 (CI floors, mutation, fuzz). Sprint 7: core-rebuild-4 and -5.

ECC hooks are on since 2026-10-14 (`~/.claude/settings.json` had `hooks_enabled: false`; now true). `continuous-learning-v2` collects observations in `~/.local/share/ecc-homunculus/`; its observer (instinct analysis) is still off, to be reviewed after about a week. The guide for which tool to use when: docs/foundation/ecc-usage.md.

**Why:** the owner approved the plan and asked to continue story by story, tests first, with reviewer agents.
**How to apply:** run `npm run story -- status`, then take core-rebuild-4 (accounts, entries, the named-operation API). Decisions closed on 2026-10-14: core-rebuild-3 review points (docs/foundation/backlog.md); core-rebuild-2 coverage (99.4 percent line coverage, one accepted exception at `store.rs:70`, recorded in docs/foundation/measurements.md); revision bodies stay JSON until release-and-quality-5 freezes a deterministic form before the first release. Still open: the review item "Code review and verification loop passed" of core-rebuild-2 (reviewer agents were not run on it with the new tiers; run rust-reviewer, silent-failure-hunter, type-design-analyzer, pr-test-analyzer) and core-rebuild-3's acceptance item "amounts cross the API as strings" (closes with the API in core-rebuild-4). See [[foundation-reset-direction]], [[workflow-notes]].
