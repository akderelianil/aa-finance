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

## Phases
| Phase | Content | Status |
|---|---|---|
| F1 Quick entry v2 | 5 buttons (Income · Expense · Transfer · Debt · ATM) + "Other" link. ATM uses the wallet automatically. Undo toast after save. Direction = colour + icon + sign. | Done 2026-10-07 |
| F2 Expense options | Installment and split inside Expense (equal split, 3+ people, the extra cent stays with me), note/receipt | Done 2026-10-07 |
| F3 Directory (Rehber) | person · brand · business; brand ↔ business many-to-many; brand default category; People page → Directory | |
| F4 Plan + Upcoming | `plans` table (debt due, card due, installment); one list on Home, overdue first; a real record closes the plan | |
| F5 Cash advance + loan | ATM withdraw from card (fee = expense); Debt → borrowed from bank (net vs agreed amount, gap = expense) | Needs the interest/profit-share decision for loans |
| F6 Term deposit | Transfer → term account; maturity in Upcoming; renewed / returned / partial | |
| Later | Deposit-for-father, FX and stock flows redesign | |

Each phase ends with: migration + deploy, `npm run lint && npm run build`, a Playwright screenshot.
