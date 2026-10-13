---
owner: backend-engineer
status: active
---

# Architecture Decision Records

Short records of decisions that shape the code. Format: Nygard (context, decision, alternatives, consequences). The first six were written on 2026-10-13 from the code and docs as they stand; the decisions themselves are older (see git history). Add a new ADR when a decision changes the data model, a rule layer, or the stack. Never rewrite an accepted ADR: supersede it with a new one.

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-local-first-sqlite-thin-rust.md) | Local-first: SQLite behind a thin Rust shell | accepted | 2026-10-13 |
| [0002](0002-single-writer-queue.md) | Single-writer queue and `max(id)+1` ids | accepted | 2026-10-13 |
| [0003](0003-pin-is-an-app-gate.md) | PIN is an app gate, not encryption | accepted | 2026-10-13 |
| [0004](0004-balance-by-base-amount-trigger.md) | Entries balance on `base_amount`, enforced by trigger | accepted | 2026-10-13 |
| [0005](0005-soft-delete-and-audit.md) | Soft delete only, with an audit trail | accepted | 2026-10-13 |
| [0006](0006-manual-exchange-rates.md) | Exchange rates are manual | accepted | 2026-10-13 |

Related: [ARCHITECTURE](../ARCHITECTURE.md) (product decisions), [local-first overview](../backend/architecture/overview.md) (technical design), [PIN gate](../pin-gate.md) (full PIN plan).
