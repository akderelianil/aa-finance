---
owner: main
status: active
---

# Hidden flows (code kept, no route)

Notes for the convenience flows hidden on 2026-10-08. Read only when you rebuild one on `journal-post` ([ROADMAP](ROADMAP.md) "Later"). Core notes: [DEVELOPMENT](DEVELOPMENT.md).

Hidden Edge Functions: onboarding-create-group, onboarding-join-group, invite-create, group-update, profile-update, avatar-upload, transaction-create/update/delete, transfer-create, debt-create, fx-exchange, installment-create/pay, investment-trade/revalue, loan-create, deposit-open/settle, plan-update, attachment-create/delete. Pages stay in `web/src/pages` without a route.

Known limits of the hidden flows:
- Edit works only for simple records (2 lines, base currency). Transfer, debt, split, FX, investment and installment records cannot be edited in the old UI.
- `installment-pay` is unused; the installment schedule is display only.
- No unrealized FX revaluation. No cross-currency transfer between FX accounts.
- Installments: base currency + credit card only. A paid installment cannot be undone.
- Attachment upload can leave an orphan row if it stops halfway.

- Quick entry (`QuickEntry` → `components/entry/*`): four kinds, Expense · Income · Transfer · Debt. Layout: large amount on top, then the main fields, then a chip row (account · date · "More"). "More" holds the rare options (installment, split, items, currency, note, tag, debt due date). The Save bar is sticky; `ResponsiveDialog` scrolls its body. Transfer has shortcut chips (ATM withdrawal, ATM deposit, card payment) that fill From/To; FX and investments are links under Transfer. `transfer-create` treats a missing side as the member's cash account. After a create, `useAfterSave` (`lib/entry.ts`) shows an Undo toast (= `transaction-delete`).
- Upcoming (`components/Upcoming.tsx`, Home): card payments from view `card_due_status` (needs statement/due day in `credit_card_settings`, set in the account form; remaining = statement debt − payments since), debt due dates from `plans` (`debt-create` `due_date`), and undated open balances. A row closes when the real record is entered (card payment, settle-up); `plan-update` postpones or dismisses. Row actions open Quick entry with a preset (`EntryPreset`).
- Cash advance: Transfer from a credit card to a cash account = `transfer-create`, `source_type='cash_advance'`; optional `fee` → expense category "Nakit avans masrafı", added to the card debt. Interest is entered as an expense when it shows on the statement.
- Loan: Debt → Borrowed → "Bank loan" = `loan-create` (opens a `loan` account + `loan_settings`; lines: deposit, fee = agreed − deposit, cost = total − agreed, credit loan = total). Installments are transfers to the loan account; view `loan_due_status` derives the next installment for Upcoming. Deleting the loan record archives the account (blocked if payments exist).
- Term deposit: Transfer → "+ New term deposit" = `deposit-open` (account subtype `deposit` + `deposit_settings`: principal, annual rate, days, withholding). Upcoming shows maturity and the expected net return (`expectedReturn`, display only). `deposit-settle`: `return` (real amount; difference = income "Vadeli getiri" or expense "Vadeli bozma kesintisi"; account closes) or `renew` (net return, optional withdrawal, new rate/days). Deleting a settle record restores the previous period (`prev`).
- Expense options: installment (`installment-create`; first due date derives from `credit_card_settings`, else +1 month) and split (`split: [{name, amount?|percent?}]` on `transaction-create`/`installment-create`, `_shared/split.ts`): my share = expense, each person = receivable line; blanks and I share the rest equally, the extra cent stays with me.

## Investments (design, hidden)
- Types: crypto, commodity (gold/silver/oil), stock, fund, bond/bill. No domestic/foreign split; each instrument has its own currency.
- FX is not an instrument. It is a normal multi-currency account.
- One investment account per member per instrument. The first buy opens it (`accounts.instrument_id`).
- Book value = market value (revaluation record with a manually entered price). A sale reduces book value pro rata by quantity; the gap goes to `investment_gain_loss`. No lot or tax-cost tracking.
- Cross-currency: a USD stock can be bought with TRY or from a USD account. The gap is derived.
