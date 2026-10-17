---
name: core-rebuild-4-decisions
description: "Owner decisions of 2026-10-16/17 for the operation API (undo, delete, settings, locks, base currency) and what is left"
metadata:
  node_type: memory
  type: project
  originSessionId: 5aeb85f2-b754-4425-a5c1-3a02130e9db4
  modified: 2026-10-17T11:57:51.362Z
---

Decisions are written in `.stories/core-rebuild-4.md` (section Decisions). Slice 1 of `ops::Ledger` is done and pushed (commits d718b49, 1712705). Base currency talk closed on 2026-10-17 (commit bc551df): base is fixed per book and locked after the first entry; moving countries is a later "carry over as a new book" feature (lots carried with cost and date), see docs/foundation/backlog.md. "See it in USD/EUR/gold" is a virtual display choice; flows use the rate of each entry's date (requirement added to core-rebuild-6).

**Why:** the owner prefers close-and-reopen over base periods (simpler, rare event); per-entry `base` was dropped as redundant.
**How to apply:** next talk is the sealed ledger kernel (ADR of invariants: double entry, balance at zero, at least two lines, append-only, exact integers, scale immutable, archived takes no new lines). Then build in the order of the story file (typed ids, settings with the base lock, rate on line, account fields and system accounts, input rules, delete, undo, API reference). See [[rebuild-status]].
