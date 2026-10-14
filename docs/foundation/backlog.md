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
