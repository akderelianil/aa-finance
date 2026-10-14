---
name: rebuild-status
description: Where the aa-finance rebuild stands (2026-10-14) and what to do first next session
metadata:
  type: project
---

State on 2026-10-14: epic foundation-reset is closed and approved by the owner (verdict "approve" in plan-canvas). ADR 0008-0019, docs/foundation/design.md and migration-plan.md are the authority. Prototype is frozen in legacy/ (tag prototype-final). Sprint 6 (28 Oct to 10 Nov per ledger, started early): core-rebuild-1 done; core-rebuild-2 (schema v1, revisions, projection, verify_projection) is in review with 49 tests green, 96 percent line coverage, 1M-entry check clean (docs/foundation/measurements.md). Open: core-rebuild-3 (amounts, rounding, rates), release-and-quality-1 (CI floors, mutation, fuzz). Sprint 7: core-rebuild-4 and -5.

**Why:** the owner approved the plan and asked to continue story by story, tests first, with reviewer agents (rust-reviewer, silent-failure-hunter, security-reviewer on keys and sync).
**How to apply:** first ask nothing; run `npm run story -- status`, then start core-rebuild-3. Open decisions to close with the owner: accept the 96 percent coverage exception (defensive branches) or delete those branches; body format is JSON until deterministic CBOR is frozen before the first release. See [[foundation-reset-direction]], [[workflow-notes]].
