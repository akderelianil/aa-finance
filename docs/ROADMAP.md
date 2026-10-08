---
owner: main
status: active
---

# Roadmap (ledger core)

Goal: a GnuCash-style double-entry core for professional personal-finance users. Started 2026-10-08.

## Decisions (2026-10-08, product owner)
- Users know accounting. The UI uses real accounting terms and follows accounting standards.
- v1 is desktop only.
- Convenience flows are hidden, not deleted: quick entry, installment, loan, deposit, FX exchange, investment, plans, start wizard, directory. Rebuild them later on `journal-post`.
- Every account has a currency (also income and expense). The owner member is optional on every account and is a label only.
- The group and its members stay. Screens show one shared ledger.
- Account code on every account. The template uses Tek Düzen Hesap Planı style codes. The user can change them.
- FX line: the server fetches the day rate when the rate is missing. A user-given rate wins.
- Not now: Num (document number), reconcile state.

## Phases
| Phase | Content | Status |
|---|---|---|
| F0 Cleanup | Rules, docs, glossary. Menu: Hesap Planı · Yevmiye · Raporlar · Ayarlar. Hide convenience routes. | Done 2026-10-08 |
| F1 Schema | Currency on every account (income/expense get the base currency). Owner optional. `accounts.code` unique per group. Template codes. | Done 2026-10-08 |
| F2 `journal-post` | One generic function: create, update, delete an entry from a line list. Balance check, row locks, rate lookup. | Done 2026-10-08 |
| F3 Chart of Accounts | Tree table: code · name · type · currency · balance (with subtree). Add, edit, move, archive. Placeholder. | Done 2026-10-08 |
| F4 General Journal | All entries by date with their lines. Inline multi-line entry form: account search (code or name), debit, credit, memo. Live difference. Keyboard entry. | |
| F5 Account Register | One account's lines with the other account and a running balance. Two-line entry inline. A split opens the journal form. | |
| F6 Reports | Trial balance, balance sheet, income statement. Date range. Base currency. | |
| Later | Rebuild convenience flows on `journal-post`. Num, reconcile, scheduled entries, FX revaluation. | |

Each phase ends with: migration + deploy (if any), `npm run lint && npm run build`, a Playwright screenshot, one commit.
