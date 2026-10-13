# ADR-0006: Exchange rates are manual

**Date**: 2026-10-13 (recorded from `entries.ts` and the product rules)
**Status**: accepted
**Deciders**: product owner

## Context
Accounts can hold different currencies, so lines need a conversion rate. Rate feeds need a network and a provider; the app is local and private.

## Decision
Rates are entered by the user and stored as text. For a foreign-currency line the base amount comes from, in order: a given rate, a given base amount, the stored rate on or before the entry date, else the entry fails with `rate_missing`. The user's own rate always wins. Server-side or automatic rates are out of v1.

## Alternatives Considered
### Online rate provider
- **Pros**: no typing.
- **Cons**: network, API keys, availability, privacy.
- **Why not**: out of scope for a local app; keeps the rate auditable by the user.

## Consequences
### Positive
- Deterministic, testable, offline.

### Negative
- The user keeps rates current.

### Risks
- Revaluation of open balances is not supported; it is a "Later" item in the roadmap.
