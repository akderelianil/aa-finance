---
owner: product-lead
status: draft
---

# Backlog ideas and their effect on the foundation (epic foundation-reset)

"F" = the idea needs room in the data model or API now, even if the feature ships later. Raised by the owner unless marked (A) for the assistant.

| Idea | Source | F? | Note |
|---|---|---|---|
| Rehber (Person, Brand, Company; brand<->company many-to-many; suggested income/expense account per brand or company) | owner | light | Exists today; suggestion must respect account visibility (RBAC). |
| Notification system (upcoming payments, updates, announcements, summaries) | owner | yes | Needs the plan/schedule entity and a local scheduler; mobile push needs the server. "Very important." |
| Calendar view (dots on days, hover list) | owner | no | A view over plans and entries; no own data. |
| Loan tracking | owner | yes | Loan terms plus computed schedule; user figure wins. |
| Property purchase, valuation, costs (land, house, shop) | owner | yes | Asset card with value history and linked entries. |
| Car purchase, depreciation, maintenance | owner | yes | Same asset card. |
| Attachments (receipts, invoices, files) | owner | yes | Blob storage abstraction, backup and encryption impact. |
| Import/export | owner | light | CSV export documented; import plugin-shaped. |
| Bank import, reconciliation | owner | light | Reserve an external reference and a reconciled marker on lines. |
| Budget, goals, plans | owner | no | Separate entities; never ledger entries. |
| Activity history (who did what, when, what changed) | owner | yes | Comes from the change log; must survive sync. |

## Assistant ideas (A)
Picked for early releases by the owner: quick entry (UI plus API/CLI; important), privacy mode, asset card, credit-card cycle (statement day, limit, rates, instalments), net worth and reports in another currency or unit.
All other ideas go to the backlog: gold/dollar-denominated net worth is covered by the unit report above; allowance and family-debt netting (a child-specific mode is not planned); time machine (as-of view); ledger doctor (health check); yearly summary; insurance/inspection reminders on the asset card; scenario packs by community; bank-specific loan calculators as plugins.

## Release sketch (owner, round 8)
- v1: free, local, one device. Income/expense, transfer, debt. Balance Sheet, Income Statement, simple Cash Flow. Multi-currency. Sync-ready data model (global ids, event log).
- Next: investments with cost method and gain/loss report; scenario engine content.
- Later: paid sync, attachments, bank import, reconciliation, notifications while the app is closed (very important for the architecture, not urgent; owner: backlog, not v1), budgets and goals, mobile.

## Decisions from the core-rebuild-3 review (owner, 2026-10-14)
Found by the reviewers on `amount.rs` and `rate.rs`.

| Question | Decision |
|---|---|
| A line has both a given rate and a given base. | They must agree: the base has to be what the rate yields, otherwise the line is refused with `rate_base_conflict` and the user chooses. This differs from the prototype (spec FX-001), where the rate won silently. Implemented. |
| How large may a rounding difference be? | One base unit per converted line, as in the prototype. Accepted. |
| The rate derived from a given base keeps 12 decimals. | Accepted as is; the base value stays exact. Revisit for tokens with tiny prices (keep 19 significant digits). |
| Scale as a type (`Scale`) and a bounded amount type (`Units`). | Deferred to core-rebuild-4, together with the real `Line` struct. |

## Test suite hygiene (owner idea, 2026-10-16)
Goal: keep the suite small, ordered and fast as it grows; remove tests that guard nothing; no documentation that must be kept by hand.

| Question | Direction (to confirm in a later session) |
|---|---|
| Hierarchy and order of test files. | Group by rule or behavior, not by code file; the module `//!` comment names the rule it guards (ADR or spec id). Already generated into `docs/foundation/test-catalog.md`. |
| Documentation of tests. | Only generated documentation (the catalog) plus a link from each topic to its rule. No hand-written test docs: they drift and become a burden. |
| Which tests are useless. | Evidence, not taste: a mutation run (`cargo mutants`) shows tests that catch nothing; coverage shows code no test reaches; a duplicate check finds tests that assert the same rule. A test that guards a money, rule or crypto invariant (ADR-0020) is never removed without a replacement. |
| Time and resources. | Record the run time per test binary in `npm run verify`; flag the slowest; keep the pre-commit hook fast and move the long runs to CI. |
| When. | After core-rebuild-4, before the test count passes about 400, as a short story in `release-and-quality`. |

## Base currency and period lock (owner, 2026-10-17)
| Question | Decision |
|---|---|
| Base currency when a family moves country. | Fixed per book. It cannot change once the first entry exists (stable error code). No base periods, no `base` on each entry. |
| Moving or re-basing. | Later feature "carry over as a new book": the old book becomes a read-only archive; the new book copies the account tree, commodities, price history, members, roles, scenario settings and open debts; one opening entry per account is written in the account's own currency and balanced by an Opening Equity account at a user-given rate; investment lots are carried with their cost and acquisition date so the gain/loss report keeps working; the new book stores `previous_book`. Not in v1. |
| "See it in another unit" (USD, EUR, gold). | A display choice, always virtual. Flows (spending, income, returns) are valued at the rate of each entry's date, balances at the latest price. Needs rate lookup by date: see core-rebuild-6. |
| Period lock date. | Dropped from v1; an idea for later with several members and reconciliation (optional `lock_date` in the settings, one check point in `Ledger`; ADR-0012). |
