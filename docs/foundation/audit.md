---
owner: product-lead
status: draft
---

# Audit of existing decisions and documents (epic foundation-reset, story 2)

Verdicts use the interview of 2026-10-13 ([interview](interview.md)). **Keep** = still true. **Change** = true in spirit, wrong in detail. **Drop** = contradicts the new direction. The old code is not a reference (owner, round 5); its tests and specs stay as a source of requirements.

## ADRs
| ADR | Verdict | Why |
|---|---|---|
| 0001 Local-first SQLite, thin Rust | **Change** | Local-first SQLite stays. "All rules in TypeScript" does not survive native mobile, E2EE and sync: the shared core must be portable (Rust is the leading candidate; story 4). |
| 0002 Single-writer queue, `max(id)+1` | **Drop** (the id part) | Ids must be globally unique before any sync. A per-device write queue may stay as an implementation detail. |
| 0003 PIN is an app gate | **Change** | The gate stays and is still called a gate. Real separation between members now comes from keys on separate devices; on a shared computer the gate is all there is, and the UI says so. |
| 0004 Balance by `base_amount` trigger | **Keep** | The strongest decision: the database is the last guard. Extend for quantities and prices of commodities. |
| 0005 Soft delete and audit | **Change** | Direction holds. The new model is append-only revisions with conflict branches and an event log that also feeds the activity history. The earlier rejection of "immutable ledger" is reversed. |
| 0006 Manual exchange rates | **Keep and extend** | "The user's value wins" stays. Add a price history for currencies and commodities; sources may be plugins later. |
| 0007 Admin grants for shared data | **Drop** | It rejected per-account visibility and kept "everyone reads everything". The owner now wants per-account RBAC; the admin can still see every account. |

## Rules in CLAUDE.md
| Rule | Verdict |
|---|---|
| Ledger core first; double entry; ≥2 balanced lines | Keep |
| Five locked roots, locked groups, free accounts, hidden codes | Open (re-check with the scenario engine) |
| UI uses real accounting terms | **Change**: the default UI speaks daily language; an expert mode may show accounting terms |
| Every account has a currency; manual rates, user rate wins | Keep; add commodities (quantity and price) |
| Journal entry is a completed event only; plans are not entries | Keep; add a separate plan/schedule entity |
| One ledger file = one family; admin/member roles | **Change** to per-account RBAC |
| Everyone reads everything | **Drop** |
| Shared data changeable only by admin or granted member | **Change** (permissions per account area) |
| 6-digit PIN, 5-minute idle lock | Keep as a device gate |
| Number and date format follow the book country | Keep |
| Entry flows: Gider, Gelir, Transfer, Borç, Serbest kayıt | Keep for v1 (the owner's three urgent scenarios) |
| Out of scope: AI/auto-fill | Keep |
| Out of scope: bank import, notifications, bills/subscriptions, sync, mobile | **Drop**: all go to the backlog or later releases |
| Money as safe-integer number in minor units | **Change**: a scale per commodity, a wider range than a JS number; decided in story 4 |
| Dates `YYYY-MM-DD` Gregorian, rates as text | Keep |
| Never edit an applied migration | Keep |
| Both logs in the SQLite file | **Change**: one event log in the ledger; the activity history is a view of it |

## Documents
| Document | Verdict |
|---|---|
| `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` | Replace after the vision (story 3) and the design (story 5) |
| `docs/backend/architecture/*`, `stack.md` | Replace with the new technical design |
| `docs/backend/database/*`, `api/*` | Rewrite for the new model; operation names and error codes are a useful inventory |
| `docs/backend/specs/**` (8 specs) | Keep as a requirement source. Story 5 marks each requirement carried, changed or dropped |
| `docs/backend/specs/FINDINGS.md` | Items 11 (raw SQL boundary) and 12 (first-PIN claim) become design inputs for the API boundary and the key model |
| `docs/pin-gate.md` | Keep as the device-gate plan; revise for the key model |
| `docs/product-designer/ux/*` (Turkish) | Re-read in the UI epic. `gider`, `gelir`, `transfer`, `borc` match the three urgent scenarios |
| `docs/RULES-TRACE.md`, `docs/HARNESS-PLAN.md`, `REPO-SCAN.md`, `DEVELOPMENT.md` | Tooling and trace: regenerate or update after the rules change |
| `docs/foundation/*` | New, authoritative for this epic |

## Contradictions inside the old documents
1. ADR-0007 keeps "everyone reads everything" for accounting transparency; the owner now wants hidden accounts (admin excepted).
2. ARCHITECTURE and CLAUDE.md say "no sync, no network"; the business model needs both.
3. The roadmap lists "plugins (trusted)" while the new plugin stance is sandboxed and permissioned.
4. The PIN docs say "not security" while the product promise to families is privacy: the new text must state exactly where separation is real.
5. "Tests with a 100% coverage floor" was reached on an API that bypasses its own rules through raw SQL (finding 11). Coverage is not the same as a safe boundary.

## Risks of the plan, stated plainly
- A full rewrite is the classic second-system trap. Mitigation: a narrow v1 (three scenarios, three reports) and the old specs as acceptance tests.
- Four languages (Rust, TypeScript/Dart/Kotlin for UI, Swift/Kotlin for mobile) strain a maintainer who is an AI. The shared Rust core is the main defence.
- A solo-run sync service with E2EE and recovery keys is an operations and support burden; the budget (25 USD per month) fits the server, not the support load.
