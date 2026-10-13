# Spec: fx-rates

> Auto-extracted by spec-miner. Last mined: 2026-10-13.
> Source: src/core/api/fx.ts, src/core/api/entries.ts (resolve), src/core/money.ts, src/core/api/settings.ts (currencies), src/core/migrations/0002_currencies.sql, 0007_audit_columns.sql
> Last verified: 2026-10-13 (commit 9bc514c)

Scope: currencies, the fixed base currency, manual exchange rates (set, list, get, delete), rate lookup for a foreign line (given rate > given base > stored rate on or before the date > `rate_missing`) and the integer conversion math. Each block lists `id`, `entities`, `enforced` (file:line) and the exact title of the covering test (`NONE` when no test covers it).

---

### Requirement: Rate lookup for a foreign line
- id: FX-001
- entities: Line, FxRate
- enforced: API `resolve` src/core/api/entries.ts:58-65 (`rate_missing`); `rateOn` src/core/api/fx.ts:19-25
- test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate

A foreign-currency line SHALL take its base from a given `rate`, else from a given `baseAmount`, else from the stored rate on or before the entry date, else fail with `rate_missing`.

#### Scenario: No rate anywhere
- **WHEN** a USD line is posted with no base, no rate and no stored USD rate
- **THEN** it fails with `rate_missing`

#### Scenario: Stored rate
- **WHEN** USD rates exist for 2026-02-01 (30) and 2026-03-01 (34.1) and a USD line is posted on 2026-03-02
- **THEN** the line stores rate '34.1' and base = amount × 34.1

---

### Requirement: Rate from a given base
- id: FX-002
- entities: Line
- enforced: API `resolve` src/core/api/entries.ts:67; `rateOf` src/core/money.ts:16-25
- test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate

When only `baseAmount` is given, the stored line rate SHALL be the rate implied by amount and base.

#### Scenario: 100 USD as 3400 TRY
- **WHEN** a USD line of 100.00 has base 3400.00
- **THEN** the line rate is '34'

---

### Requirement: Get the rate for a date
- id: FX-003
- entities: FxRate
- enforced: API `fx.get` src/core/api/fx.ts:17-25
- test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate

`fx.get` SHALL return the newest live rate on or before the date, or null.

#### Scenario: Before the first rate
- **WHEN** the date is before every stored USD rate
- **THEN** `fx.get` returns null

---

### Requirement: Set a rate
- id: FX-004
- entities: FxRate
- enforced: API `fx.set` src/core/api/fx.ts:28-39
- test: fx.set on an existing date updates the rate instead of adding a row

`fx.set` SHALL update the live rate of that currency and date, or add one, and return its id.

#### Scenario: Same date twice
- **WHEN** USD on 2026-03-01 is set to 34, then 35
- **THEN** both calls return the same id and the list shows only 35

---

### Requirement: No rate for the base currency or an unknown code
- id: FX-005
- entities: FxRate, Currency
- enforced: API `fx.set` src/core/api/fx.ts:30-31 (`fx_base_currency`, `currency_unknown`)
- test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate

`fx.set` SHALL reject the base currency with `fx_base_currency` and an unknown code with `currency_unknown`.

#### Scenario: Rate for TRY in a TRY book
- **WHEN** `fx.set` is called for TRY
- **THEN** it fails with `fx_base_currency`

---

### Invariant: Rates are positive decimal text
- id: FX-006
- entities: FxRate, Line
- enforced: API `rate` src/core/api/ctx.ts:42 (`invalid_input`); CHECK on `fx_rates.rate` src/core/migrations/0007_audit_columns.sql:126-129 and `lines.rate` :215-220
- test: amounts: integers only, nonzero, same sign; base and rate follow the account currency

A rate SHALL be text of digits with an optional single decimal point and a value above zero; a comma or other text is rejected.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Invariant: One live rate per currency and date
- id: FX-007
- entities: FxRate
- enforced: unique index `fx_rates_currency_date` src/core/migrations/0007_audit_columns.sql:136; mapped to `fx_rate_exists` src/core/api/errors.ts:17
- test: fx.set on an existing date updates the rate instead of adding a row

There SHALL be at most one live rate for each currency and date.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Requirement: Delete a rate
- id: FX-008
- entities: FxRate
- enforced: API `fx.delete` src/core/api/fx.ts:41-45 (`fx_rate_not_found`); triggers src/core/migrations/0007_audit_columns.sql:425-427 (`no_delete`, `row_deleted`)
- test: fx.list returns live rates newest first, filtered by currency; remove hides a rate

`fx.delete` SHALL soft delete a live rate; lookups then fall back to the next older rate, and deleting it again fails with `fx_rate_not_found`.

#### Scenario: Delete the newest rate
- **WHEN** the 2026-03-01 USD rate is deleted
- **THEN** `fx.get` for 2026-03-15 returns the 2026-02-01 rate

---

### Requirement: List rates
- id: FX-009
- entities: FxRate
- enforced: API `fx.list` src/core/api/fx.ts:7-15
- test: fx.list returns live rates newest first, filtered by currency; remove hides a rate

`fx.list` SHALL return live rates ordered by currency code, then newest date first, optionally for one currency.

#### Scenario: Filter by currency
- **WHEN** `fx.list` is called with USD
- **THEN** only USD rates come back, newest first

---

### Requirement: Convert minor units with a rate
- id: FX-010
- entities: Money
- enforced: `toBase` src/core/money.ts:7-13, `divRound` :27-31
- test: toBase converts minor units and rounds half away from zero

`toBase` SHALL multiply integer minor units by a decimal rate with BigInt math, scale between the two currencies' minor units, and round half away from zero.

#### Scenario: Half a kuruş
- **WHEN** 1 minor unit is converted at '0.5'
- **THEN** the result is 1 (and -1 for -1)

---

### Requirement: Rate from two amounts
- id: FX-011
- entities: Money
- enforced: `rateOf` src/core/money.ts:16-25
- test: rateOf gives back the rate of two amounts

`rateOf` SHALL return the rate between two same-sign amounts with up to 12 decimals and no trailing zeros.

#### Scenario: Repeating rate
- **WHEN** 3.00 becomes 10.00
- **THEN** the rate is '3.333333333333'

---

### Invariant: The base currency is fixed
- id: FX-012
- entities: Setting, Currency
- enforced: triggers `settings_insert` src/core/migrations/0007_audit_columns.sql:429-431 (`currency_unknown`) and `settings_update` :437 (`base_currency_fixed`)
- test: base currency is fixed

The base currency SHALL be a known currency set once at setup and never changed.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Requirement: Setup rejects an unknown base currency
- id: FX-013
- entities: Setting, Currency
- enforced: API src/core/api/settings.ts:27 (`currency_unknown`); trigger `settings_insert` src/core/migrations/0007_audit_columns.sql:429-431
- test: setup rejects an unknown base currency

Setup SHALL fail with `currency_unknown` when the base currency code is not in the currency list.

#### Scenario: XXX as base
- **WHEN** setup runs with base currency XXX
- **THEN** it fails with `currency_unknown`

---

### Requirement: Currency list
- id: FX-014
- entities: Currency
- enforced: API `currencies.list` src/core/api/settings.ts:119-122; open op src/core/api/index.ts:64; data src/core/migrations/0002_currencies.sql
- test: before setup only setup.run and currencies.list work; setup runs once

`currencies.list` SHALL return every ISO 4217 currency with code, name and minor unit (0 to 4), also before setup.

#### Scenario: Before setup
- **WHEN** `currencies.list` is called on a fresh file
- **THEN** TRY is listed with minor unit 2

---

### Invariant: Currencies are read-only
- id: FX-015
- entities: Currency
- enforced: triggers `currencies_no_update` src/core/migrations/0007_audit_columns.sql:244 (`currency_fixed`) and `currencies_no_delete` :234 (`no_delete`)
- test: no table allows DELETE

Currency rows SHALL never be updated or deleted.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Invariant: Posted lines keep their rate
- id: FX-016
- entities: Line, FxRate
- enforced: `fx.set`/`fx.delete` write only `fx_rates` src/core/api/fx.ts:28-45; posted lines are frozen src/core/migrations/0007_audit_columns.sql:375-376
- test: NONE

Setting or deleting a stored rate SHALL NOT change the rate or base amount of lines already posted.

> Last verified: 2026-10-13 (commit 9bc514c)

<!-- uncertainty: the database itself does not forbid an fx_rates row for the base currency; only fx.set checks it. -->
