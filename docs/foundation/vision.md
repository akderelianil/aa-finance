---
owner: product-lead
status: draft
---

# Vision

## Purpose
A person with no accounting knowledge can run every personal and family money decision with this app, in the words of daily life, while the books underneath follow professional double-entry rules. It is free and private on the user's own device. People who want sync across devices pay for it; the app and its protocols stay open source.

## Who it is for
- Adults (18+) keeping their own money, alone or as a family of up to 10 people, each with their own devices over time.
- First user: the owner's family in Turkey. Later: anyone in the world, so every currency and commodity is in scope.
- Not for businesses, tax filing or e-invoicing. People track their finances for themselves.

## Principles
1. **Your data is yours.** An open, documented schema; CSV export of everything; a separate full, restorable backup; no lock-in. Deleting everything is one action away.
2. **Never lose a record.** Append-only revisions, undo instead of delete, automatic verified backups, conflicts kept and shown.
3. **Private by default.** End-to-end encrypted sync, no telemetry, crash reports only with consent. Where separation is only an app gate, the app says so.
4. **Honest accounting underneath, daily words on top.** Scenario templates (income, expense, transfer, debt, loan, card, investment...) build correct entries from plain questions. Estimates and forecasts never enter the ledger; the user's real record always wins.
5. **Local first, sync-ready.** v1 works on one device without a server; the data model already carries global ids and an event log.
6. **Open and extensible.** Clients and core MIT, sync server AGPL (self-hosting welcome), contributions under the DCO. Plugins are sandboxed and permissioned; every plugin write passes the same rules as the app.
7. **Quality over speed.** There is no deadline. Integrity, then privacy and security, then compatibility, resource use and performance, in that order.

Model to follow: Obsidian's spirit (local files you own, paid sync and a plugin ecosystem, respect for the user), with a stricter plugin sandbox because this is financial data.

## Goals by release
| Release | Scope |
|---|---|
| v1 (free, local, one device) | Income/expense, transfer, debt scenarios; Balance Sheet, Income Statement, simple Cash Flow; multi-currency; accounts and per-account roles for a family; backup, restore, export; Turkish and English |
| Next | Investments (stocks, funds, gold, crypto, commodities) with lots, price history, the user's cost method and the realized/unrealized gain-loss report; scenario packs |
| Early picks | Quick entry (UI and CLI/API), privacy mode, asset card with value-estimate history, credit-card cycle, net worth in another currency or unit |
| Later | Paid sync (E2EE) and self-hosting, attachments, bank import and reconciliation, notifications while the app is closed, budgets and goals, loan tracking, mobile (native), official plugins |

## Non-goals
AI or auto-fill, business accounting, tax and legal reporting, accounts for minors, telemetry, a hosted service that can read user data.

## Success
- A person who has never heard of debit and credit records a loan, an instalment purchase and a currency exchange correctly.
- Years of records survive disk failure, mistaken deletes and app upgrades.
- Families keep private accounts private across devices.
- Developers can ship a plugin or a scenario pack without touching the core.
