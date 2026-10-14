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

## Open decisions from the core-rebuild-3 review (2026-10-14)
Found by the reviewers on `amount.rs` and `rate.rs`; the code follows the prototype until the owner decides.

| Question | Now | Why it matters |
|---|---|---|
| A line has both a given rate and a given base. | The rate wins, the base is dropped silently (prototype, spec FX-001). | The user's real record should win; a silent drop hides a conflicting input. Option: refuse with a stable code when both are given, or accept both only if they agree. |
| How large may a rounding difference be? | One base unit per converted line (prototype). | A bound of half that is the tightest a half-away rounding can produce; the looser rule can hide a real one-cent typo in the Rounding account. |
| The rate derived from a given base keeps 12 decimals. | A rate below 1e-12 is refused (`rate_invalid`), the base value stays exact. | Tokens with 18 decimals and tiny prices need more digits. Option: keep 19 significant digits, or store no rate when it cannot be derived. |
| Scale as a type (`Scale`) and a bounded amount type (`Units`). | Raw `i64` plus `u8` scale. | Two scales in a row can be swapped. Better added with the real `Line` struct in core-rebuild-4. |
