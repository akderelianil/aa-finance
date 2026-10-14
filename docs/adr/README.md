---
owner: backend-engineer
status: active
---

# Architecture Decision Records

Short records of decisions that shape the code. Format: Nygard (context, decision, alternatives, consequences). ADR 0001 to 0006 were written on 2026-10-13 from the code and docs as they stand; the decisions themselves are older (see git history). Add a new ADR when a decision changes the data model, a rule layer, or the stack. Never rewrite an accepted ADR: supersede it with a new one.

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-local-first-sqlite-thin-rust.md) | Local-first: SQLite behind a thin Rust shell | superseded in part | 2026-10-13 |
| [0002](0002-single-writer-queue.md) | Single-writer queue and `max(id)+1` ids | superseded | 2026-10-13 |
| [0003](0003-pin-is-an-app-gate.md) | PIN is an app gate, not encryption | superseded for security (device gate stays) | 2026-10-13 |
| [0004](0004-balance-by-base-amount-trigger.md) | Entries balance on `base_amount`, enforced by trigger | accepted, extended by 0010 | 2026-10-13 |
| [0005](0005-soft-delete-and-audit.md) | Soft delete only, with an audit trail | superseded | 2026-10-13 |
| [0006](0006-manual-exchange-rates.md) | Exchange rates are manual | accepted, extended by 0010 | 2026-10-13 |
| [0007](0007-admin-grants-for-shared-data.md) | The admin grants who may change shared data | superseded | 2026-10-13 |
| [0008](0008-shared-rust-core.md) | One shared Rust core behind a named-operation API | accepted | 2026-10-13 |
| [0009](0009-chromium-shell-react-ui.md) | Chromium-based shell with a React UI; native mobile screens later | accepted | 2026-10-13 |
| [0010](0010-amounts-commodities-balancing.md) | Amounts, commodities, rounding and balancing | accepted | 2026-10-13 |
| [0011](0011-identity-numbering-time.md) | Global ids, no gapless numbers, civil dates | accepted | 2026-10-13 |
| [0012](0012-revisions-as-truth.md) | Immutable revisions, a projection, and conflicts that are kept | accepted | 2026-10-13 |
| [0013](0013-sync-and-hosted-server.md) | Sync protocol first; hosted server on Cloudflare; self-hosting on the user's own Cloudflare account | accepted | 2026-10-13 |
| [0014](0014-keys-identity-recovery.md) | Account separate from keys; per-account keys; signed membership log; recovery | accepted | 2026-10-13 |
| [0015](0015-per-account-roles.md) | Per-account roles replace "everyone reads everything" | accepted | 2026-10-13 |
| [0016](0016-scenarios-and-plugins.md) | Scenarios as data; sandboxed, permissioned WebAssembly plugins | accepted | 2026-10-13 |
| [0017](0017-reminder-helper.md) | A tiny reminder helper for notifications while the app is closed | accepted | 2026-10-13 |
| [0018](0018-quality-gates-and-release-security.md) | Quality gates, test layers and release security | accepted | 2026-10-13 |
| [0019](0019-licenses-contribution-privacy.md) | Licenses, contributions and privacy defaults | accepted | 2026-10-13 |
| [0020](0020-coverage-floor-95-on-money-rules-crypto.md) | Coverage floor of 95 percent on money, rules and crypto (supersedes the floor in 0018) | accepted | 2026-10-14 |


Related: [ARCHITECTURE](../ARCHITECTURE.md) (product decisions), [local-first overview](../../legacy/docs/backend/architecture/overview.md) (technical design), [PIN gate](../../legacy/docs/pin-gate.md) (full PIN plan).
The epic `foundation-reset` replaced the prototype decisions on 2026-10-13: ADR 0008 to 0019 are the foundation of the rebuild; see [audit](../foundation/audit.md).
