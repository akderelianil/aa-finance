# ADR-0004: Entries balance on `base_amount`, enforced by trigger

**Date**: 2026-10-13 (recorded from schema `0001` and `entries.ts`)
**Status**: accepted
**Deciders**: product owner, backend

## Context
Every account has a currency, so one entry can mix currencies. Double entry needs a single unit to compare debits and credits. The rule must hold even if code bypasses the API.

## Decision
Each line stores `amount` (account currency) and `base_amount` (book base currency, integer minor units). An entry has at least two lines and total debit equals total credit in `base_amount`. A trigger enforces it when the entry is posted (`entry_too_few_lines`, `entry_unbalanced`). The API checks first for clear messages. A rounding difference of up to one minor unit per converted line goes to the `fx_gain_loss` system account; a larger one fails.

## Alternatives Considered
### Check only in the API
- **Pros**: simpler SQL.
- **Cons**: any other writer (a script, a plugin, a bug) can unbalance the books.
- **Why not**: the database must be the last guard.

### Balance per currency
- **Pros**: no conversion rounding.
- **Cons**: not how a book works; reports need one base currency.
- **Why not**: a single base unit makes the trial balance a plain sum.

## Consequences
### Positive
- An unbalanced posted entry cannot exist; tests assert the stable error codes.

### Negative
- Rounding is a visible accounting concept (`fx_gain_loss`).
- The trigger and the API check must stay in step.

### Risks
- A change to rounding rules touches both layers and past entries. Add a migration and a test per change.
