---
name: core-rebuild-4-decisions
description: "Owner decisions of 2026-10-16/17 for the operation API (undo, delete, settings, base currency, sealed kernel) and what is left"
metadata:
  node_type: memory
  type: project
  originSessionId: 5aeb85f2-b754-4425-a5c1-3a02130e9db4
  modified: 2026-10-17T12:19:43.139Z
---

Decisions are written in `.stories/core-rebuild-4.md` (sections Decisions and Progress). Done and pushed: slice 1 of `ops::Ledger` (d718b49, 1712705), base currency decision and backlog notes (bc551df), ADR-0021 sealed ledger kernel, accepted (table K1 to K21; K19 delete, K20 locked system accounts, K21 base currency lock are still to build), `entry_must_start_as_draft` code (6a6339c), `kernel:check` (08f9d2d), typed `DocId` and `RevisionId` (ad3e285).

Base currency (2026-10-17): fixed per book, locked after the first entry (`base_currency_locked`); moving countries is a later "carry over as a new book" feature (old book read-only archive, opening entry per account in the account's own currency against an Opening Equity account, lots carried with cost and date, `previous_book` link). "See it in USD, EUR or gold" is a virtual display choice: flows use the rate of each entry's date, balances the latest price, missing day uses the nearest earlier rate with a note (acceptance criterion of core-rebuild-6). Commodities have no archive (ADR-0012 corrected). The period lock date is dropped from v1.

**Why:** the owner prefers close-and-reopen over base periods (simpler, rare event); per-entry `base` was dropped as redundant. The owner chose a table form for the kernel (each row maps to a code and a test).
**How to apply:** next talk is what the settings document holds (propose only the base currency in v1; format and language settings come with the UI). Then build in the story order: settings with the base lock, rate on line, account fields and system accounts, input rules, delete, undo, API reference. When K19 to K21 are built, move them into the sealed table of ADR-0021. See [[rebuild-status]].
