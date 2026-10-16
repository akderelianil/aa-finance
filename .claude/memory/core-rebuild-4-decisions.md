---
name: core-rebuild-4-decisions
description: Owner decisions of 2026-10-16 for the operation API (undo, delete, settings, locks) and what waits for the next session
metadata:
  type: project
---

Decisions are written in `.stories/core-rebuild-4.md` (section Decisions). Slice 1 of `ops::Ledger` is done and pushed (commits d718b49, 1712705). No code was written after the decisions: the owner wants the next session to start with two talks, then build.

**Why:** the owner asked to talk first and not develop in the session where the questions were answered.
**How to apply:** next session first discuss (a) base currency change when a family moves country (base-period list proposal, not approved) and (b) a sealed ledger kernel (ADR of invariants: double entry, balance at zero, at least two lines, append-only, exact integers, scale immutable, archived takes no new lines). Also note the dropped lock date in ADR-0012 and the backlog. Then build in the order in the story file. See [[rebuild-status]].
