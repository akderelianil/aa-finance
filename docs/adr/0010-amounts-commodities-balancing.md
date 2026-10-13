# ADR-0010: Amounts, commodities, rounding and balancing

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: Extends [ADR-0004](0004-balance-by-base-amount-trigger.md) and [ADR-0006](0006-manual-exchange-rates.md).

## Context
The prototype stored money as JavaScript numbers in minor units. Commodities (gold, shares, crypto, funds) need quantities, prices and cost bases. Crypto has up to 18 decimals and some tokens are held in trillions. The owner wants exact books, user-given values winning, a price history, virtual valuation, and a user-chosen cost method.

## Decision
A line stores `quantity` (a signed 64-bit integer scaled per commodity) and `base_value` (signed 64-bit, book-currency minor units; debit positive, credit negative). A commodity has an accounting `scale`, immutable once used; it is chosen so holdings fit (largest plausible holding times 10^scale below 9.2e18 divided by 1000). CHECK constraints bound stored values; SQL `sum()` is used because it raises on overflow ([SQLite docs](https://www.sqlite.org/lang_aggfunc.html)), `total()` never; reports aggregate in the core with checked i128. A posted entry sums to exactly zero on `base_value`, no tolerance, checked by a trigger when the revision moves from draft to posted (SQLite has no deferred constraints). The core computes `base_value` from quantity and rate; a user-given rate or base amount always wins; per-line rounding and amounts finer than the scale go to an explicit line on a system Rounding account in the book currency, visible to the user. Exchanges and same-commodity moves are made quantity-balanced with GnuCash-style trading accounts created invisibly by scenarios. Rates and prices are decimal text; arithmetic is exact (scaled i128 or a vetted decimal library; `rust_decimal` has a 96-bit mantissa, so check before use) with one rounding rule, half away from zero. A price history keyed by commodity, quote, date and source holds user-given prices above fetched ones, with one defined path for cross rates and a unit conversion table (gram, ounce). The price used when posting is frozen into `base_value`; reports value holdings at the latest price virtually, with an info tip. Lots: the user picks the cost method (FIFO, LIFO, average, specific lot, highest cost); specific-lot choices are user data; realized and unrealized gains are derived; a partly consumed lot splits `base_value` with the residual on the last piece; a change of method posts adjustment entries, history intact. The book currency is fixed per ledger; reports can show any unit; a re-base tool may come later.

## Alternatives Considered
### 128-bit integers (two columns or a blob)
- **Pros**: Huge range
- **Cons**: No SQL sum; every total needs code
- **Why not**: Costs performance and simplicity

### Decimal text
- **Pros**: Any precision
- **Cons**: No sorting or summing in SQL; slow
- **Why not**: Rejected

### Floats
- **Pros**: Fast
- **Cons**: Inexact
- **Why not**: Never for money

### User-entered base value on every line
- **Pros**: Exact integer arithmetic
- **Cons**: Forces users to compute
- **Why not**: The core computes; the user may override


## Consequences
### Positive
- Exact, fast sums at 3 million lines; overflow is loud, not silent.
- Commodities and gain reports need no later model change.

### Negative
- Sub-scale amounts are rounded (shown as a Rounding line).
- Several decimal libraries need checking at implementation.

### Risks
- Scale mistakes are expensive to repair: the scale is immutable once used and changed only by a rewrite tool.
