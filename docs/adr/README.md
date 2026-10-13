---
owner: backend-engineer
status: active
---

# Architecture Decision Records

Short records of decisions that shape the code. Format: Nygard (context, decision, alternatives, consequences). ADR 0001 to 0006 were written on 2026-10-13 from the code and docs as they stand; the decisions themselves are older (see git history). Add a new ADR when a decision changes the data model, a rule layer, or the stack. Never rewrite an accepted ADR: supersede it with a new one.

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-local-first-sqlite-thin-rust.md) | Local-first: SQLite behind a thin Rust shell | accepted, changes (audit) | 2026-10-13 |
| [0002](0002-single-writer-queue.md) | Single-writer queue and `max(id)+1` ids | dropped (audit) | 2026-10-13 |
| [0003](0003-pin-is-an-app-gate.md) | PIN is an app gate, not encryption | accepted, changes (audit) | 2026-10-13 |
| [0004](0004-balance-by-base-amount-trigger.md) | Entries balance on `base_amount`, enforced by trigger | accepted | 2026-10-13 |
| [0005](0005-soft-delete-and-audit.md) | Soft delete only, with an audit trail | accepted, changes (audit) | 2026-10-13 |
| [0006](0006-manual-exchange-rates.md) | Exchange rates are manual | accepted | 2026-10-13 |
| [0007](0007-admin-grants-for-shared-data.md) | The admin grants who may change shared data | dropped (audit) | 2026-10-13 |

Related: [ARCHITECTURE](../ARCHITECTURE.md) (product decisions), [local-first overview](../backend/architecture/overview.md) (technical design), [PIN gate](../pin-gate.md) (full PIN plan).

The epic `foundation-reset` reviewed every ADR on 2026-10-13: see [audit](../foundation/audit.md). Statuses marked (audit) become `superseded` when the new ADRs are written (story `foundation-reset-5`).
