---
name: rebuild-status
description: Where the aa-finance rebuild stands (2026-10-14) and what to do first next session
metadata:
  type: project
---

State on 2026-10-14: foundation-reset is closed and approved. Prototype is frozen in legacy/ (tag prototype-final). Sprint 6: core-rebuild-1 done; core-rebuild-2 (schema v1, revisions, projection, verify_projection) in review; core-rebuild-3 (amounts, rates, rounding line: `crates/core/src/amount.rs`, `rate.rs`) in review, 100 percent line coverage on both files, four reviewer agents run and fixed. Open: release-and-quality-1 (CI floors, mutation, fuzz). Sprint 7: core-rebuild-4 and -5.

ECC hooks are on since 2026-10-14 (`~/.claude/settings.json` had `hooks_enabled: false`; now true). `continuous-learning-v2` collects observations in `~/.local/share/ecc-homunculus/`; its observer (instinct analysis) is still off, to be reviewed after about a week. The guide for which tool to use when: docs/foundation/ecc-usage.md.

**Why:** the owner approved the plan and asked to continue story by story, tests first, with reviewer agents.
**How to apply:** run `npm run story -- status`, then take core-rebuild-4 (accounts, entries, the named-operation API) unless the owner wants to review 2 and 3 first. Open decisions for the owner are listed in docs/foundation/backlog.md ("Open decisions from the core-rebuild-3 review") and: accept the 96 percent coverage exception in core-rebuild-2 or delete those defensive branches; JSON body format until deterministic CBOR is frozen. The acceptance item "amounts cross the API as strings" of core-rebuild-3 stays open until the API exists (core-rebuild-4). See [[foundation-reset-direction]], [[workflow-notes]].
