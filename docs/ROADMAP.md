---
owner: main
status: active
---

# Roadmap (UX map → code)

Source: [ux/harita.md](ux/harita.md). Started 2026-10-07.

## Decisions (2026-10-07, product owner)
- All proposals in harita §7 are accepted: deposit-for-father (emanet) is after v1; card payment = Transfer → card; card statement/due day is entered once per card; Undo = last record right away, later Edit/Delete, a multi-line record undoes in one step; terms "getiri" / "maliyet".
- All "(Öneri: …)" items in [ux/acik-sorular.md](ux/acik-sorular.md) are accepted as decisions.
- harita §6 is accepted: "Diğer" keeps only FX, investment and deposit-for-father. Cash advance = ATM → withdraw with a credit card. Term deposit = Transfer → term account. Loan = Debt → borrowed, from a bank.

- Loan (2026-10-07): the total repayment is the debt on the loan day; total − agreed amount is a cost expense that day; agreed − deposited amount is a fee expense. Each installment is a transfer to the loan account. An early-payoff discount is a "Fark" that reduces the cost.
- Term deposit (2026-10-07): the user enters principal + rate + days; the expected net return is derived (withholding rate per account). At maturity the real amount is entered; the difference is income or expense.
- Account template (2026-10-08): placeholder is a manual setting per category (not derived from children). Every member gets a cash account. The start wizard asks for bank accounts, cards and loans. Allowance between members = expense for the giver, income for the receiver (two records). "Kupon & Hediye Çeki" is income (discount coupon, gift balance). Brand → category defaults are part of the template. Existing groups get it by migration.

## Phases
| Phase | Content | Status |
|---|---|---|
| F1 Quick entry v2 | 5 buttons (Income · Expense · Transfer · Debt · ATM) + "Other" link. ATM uses the wallet automatically. Undo toast after save. Direction = colour + icon + sign. | Done 2026-10-07 |
| F2 Expense options | Installment and split inside Expense (equal split, 3+ people, the extra cent stays with me), note/receipt | Done 2026-10-07 |
| F3 Directory (Rehber) | person · brand · business; brand ↔ business many-to-many; brand default category; People page → Directory | Done 2026-10-07 |
| F4 Plan + Upcoming | `plans` table (debt due, card due, installment); one list on Home, overdue first; a real record closes the plan | Done 2026-10-07 |
| F5 Cash advance + loan | ATM withdraw from card (fee = expense); Debt → borrowed from bank (net vs agreed amount, gap = expense) | Done 2026-10-07 |
| F6 Term deposit | Transfer → term account; maturity in Upcoming; renewed / returned / partial | Done 2026-10-07 |
| F7 Account template | Category tree + `template_key`, brand defaults, wallet per member, start wizard `/baslangic` | Done 2026-10-08 |
| Later | Deposit-for-father, FX and stock flows redesign | |
| v2 backlog | Real estate and vehicle assets (own subtype, value change record) | |

Each phase ends with: migration + deploy, `npm run lint && npm run build`, a Playwright screenshot.
