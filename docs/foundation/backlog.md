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
