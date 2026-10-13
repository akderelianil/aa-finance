# Spec: quick-entry

> Auto-extracted by spec-miner. Last mined: 2026-10-13.
> Source: src/core/quick.ts, src/core/money.ts, src/core/quick.test.ts
> Last verified: 2026-10-13 (commit 9bc514c)

Scope: the pure Quick Entry builders (Gider, Gelir, Transfer, Borç) that turn a form into an `entries.post` input. They throw `QuickError` with a `quick_*` code; the posted result is checked again by the API and the database. Each block lists `id`, `entities`, `enforced` (file:line) and the exact title of the covering test (`NONE` when no test covers it).

---

### Requirement: Gider (expense) accounts
- id: QUICK-001
- entities: QuickAccount, Split
- enforced: `expense` src/core/quick.ts:27-32 (`quick_payment_account`, `quick_expense_account`)
- test: expense: splits on a card; a foreign payment converts with the last split taking the rounding

`expense` SHALL pay from an asset or liability account (credit) and debit only expense accounts.

#### Scenario: Income account as a split
- **WHEN** a split uses the Salary account
- **THEN** the builder throws `quick_expense_account`

---

### Requirement: Gelir (income) accounts
- id: QUICK-002
- entities: QuickAccount, Split
- enforced: `income` src/core/quick.ts:35-40 (`quick_receive_account`, `quick_income_account`)
- test: income: received into an asset, split over income accounts

`income` SHALL receive into an asset account (debit) and credit only income accounts.

#### Scenario: Card as receiving account
- **WHEN** the receiving account is a credit card (liability)
- **THEN** the builder throws `quick_receive_account`

---

### Requirement: Split amounts are positive and add up
- id: QUICK-003
- entities: Split
- enforced: `split` src/core/quick.ts:47-48 (`quick_amount`, `quick_split_mismatch`)
- test: expense: splits on a card; a foreign payment converts with the last split taking the rounding

The total and every split SHALL be positive, and the splits SHALL sum to the total.

#### Scenario: Splits short of the total
- **WHEN** total is 5 and the only split is 4
- **THEN** the builder throws `quick_split_mismatch`

---

### Requirement: Splits paid from different accounts
- id: QUICK-004
- entities: Split, QuickAccount
- enforced: `split` src/core/quick.ts:50-64 (`quick_currency_unsupported`)
- test: expense: splits on a card; a foreign payment converts with the last split taking the rounding

When a split names its own money account, the builder SHALL write one money line per paying account with the summed split amounts; all accounts must share one currency.

#### Scenario: One split paid from the bank
- **WHEN** a 500.00 card expense has a 200.00 split paid from Akbank
- **THEN** the lines are card -300.00, Akbank -200.00 and the two expense debits

---

### Requirement: One-currency forms leave conversion to the server
- id: QUICK-005
- entities: Split, QuickAccount
- enforced: `split` src/core/quick.ts:65-75; `pair` src/core/quick.ts:142-153
- test: income: received into an asset, split over income accounts

When all accounts share the money currency, the builder SHALL send amounts only (plus the given rate for a foreign currency) and let `entries.post` convert.

#### Scenario: TRY income
- **WHEN** 150.00 TRY is split over Salary and Bonus
- **THEN** the lines carry amounts with equal base amounts and no rate

---

### Requirement: Foreign payment with base-currency splits
- id: QUICK-006
- entities: Split, QuickAccount
- enforced: `split` src/core/quick.ts:76-90 (`quick_currency_unsupported`, `quick_rate_required`)
- test: expense: splits on a card; a foreign payment converts with the last split taking the rounding

When the money account is foreign and splits are in the base currency, a rate SHALL be given; each split gets an exact base amount and the last split takes the rounding so the entry balances exactly.

#### Scenario: Three 0.01 USD splits at 33.335
- **WHEN** a 0.03 USD expense is split in three
- **THEN** the base amounts are 33, 33 and 34 kuruş against 100 kuruş on the USD line

#### Scenario: No rate
- **WHEN** a foreign payment has base-currency splits and no rate
- **THEN** the builder throws `quick_rate_required`

---

### Requirement: Transfer accounts
- id: QUICK-007
- entities: QuickAccount
- enforced: `transfer` src/core/quick.ts:98-108 (`quick_same_account`, `quick_from_account`, `quick_to_account`)
- test: transfer: ATM with fee, card payment, and across currencies

`transfer` SHALL move money from an asset to a different asset or liability account: `to` debit, `from` credit.

#### Scenario: From a card
- **WHEN** the source is a credit card
- **THEN** the builder throws `quick_from_account`

---

### Requirement: Transfer fee
- id: QUICK-008
- entities: QuickAccount
- enforced: `transfer` src/core/quick.ts:105-107 (`quick_fee_account`); `pair` src/core/quick.ts:164-168 (`quick_currency_unsupported`)
- test: transfer: a fee account in a third currency is rejected

A fee SHALL go to an expense account as an extra debit in the `from` currency, and the `from` line credits amount plus fee; a fee account in a third currency is rejected.

#### Scenario: EUR fee account on a TRY transfer
- **WHEN** a TRY transfer names a EUR fee account
- **THEN** the builder throws `quick_currency_unsupported`

---

### Requirement: Cross-currency pair
- id: QUICK-009
- entities: QuickAccount
- enforced: `pair` src/core/quick.ts:154-170 (`quick_amount_required`, `quick_rate_required`)
- test: transfer: ATM with fee, card payment, and across currencies

Across currencies the debit-side amount SHALL be given; the rate comes from the two amounts when one side is the base currency, else a rate for the credit currency is required.

#### Scenario: USD to EUR without rate
- **WHEN** USD is moved to a EUR account with no rate
- **THEN** the builder throws `quick_rate_required`

#### Scenario: USD sold for TRY
- **WHEN** 100 USD becomes 3400 TRY with a 1 USD fee
- **THEN** the fee and USD lines are converted at 34, the rate implied by the two amounts

---

### Requirement: Borç (debt) kinds
- id: QUICK-010
- entities: QuickAccount, DebtKind
- enforced: `debt` src/core/quick.ts:118-131 (`quick_money_account`, `quick_debt_account`)
- test: debt: lend, borrow, collect, repay move the right sides

`debt` SHALL use an asset receivable for lend and collect and a liability for borrow and repay; lend and repay debit the debt account, borrow and collect debit the money account.

#### Scenario: Lend to a payable
- **WHEN** `lend` names a payables account
- **THEN** the builder throws `quick_debt_account`

---

### Requirement: Borç across currencies
- id: QUICK-011
- entities: QuickAccount
- enforced: `debt` src/core/quick.ts:125 (`quick_amount_required`)
- test: debt: lend, borrow, collect, repay move the right sides

When the money and debt accounts differ in currency, `debtAmount` SHALL be given.

#### Scenario: Collect a TRY receivable into USD
- **WHEN** 100 USD is collected against a 3400 TRY receivable with `debtAmount`
- **THEN** the USD line gets base 3400 TRY and the entry balances

---

### Requirement: The contact rides on the debt line
- id: QUICK-012
- entities: Line, Contact
- enforced: `debt` src/core/quick.ts:129-130
- test: debt: the Rehber contact rides on the debt line only

The Rehber `contact` SHALL be set on the debt account line only.

#### Scenario: Lend to Ali
- **WHEN** a lend names contact 7
- **THEN** the receivable line has contact 7 and the wallet line has none

---

### Invariant: Builder output balances without FX rounding
- id: QUICK-013
- entities: EntryInput
- enforced: `split` src/core/quick.ts:81-90; `pair` src/core/quick.ts:160-170
- test: transfer: ATM with fee, card payment, and across currencies

When currencies differ, the builders SHALL send exact base amounts whose sum is zero, so `entries.post` adds no FX Gains and Losses line.

> Last verified: 2026-10-13 (commit 9bc514c)

<!-- uncertainty: quick_amount (non-positive amounts) and quick_money_account have no direct test. -->
