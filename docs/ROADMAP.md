---
owner: main
status: active
---

# Roadmap (ledger core)

Goal: a GnuCash-style double-entry core for professional personal-finance users. Started 2026-10-08.

## Decisions (2026-10-08, product owner)
- Users know accounting. The UI uses real accounting terms and follows accounting standards.
- v1 is desktop only.
- Convenience flows (installment, loan, deposit, FX exchange, investment, plans, start wizard, legacy quick entry) were deleted on 2026-10-08; git history keeps them. Rebuild later on `journal-post`, driven by `docs/ux/`.
- Every account has a currency (also income and expense). The owner member is optional on every account and is a label only.
- The group and its members stay. Screens show one shared ledger.
- Account code on every account for sorting. The UI does not show it. The chart is simple: five roots, locked system groups, free accounts below. The system sets the frame; the user fills it.
- FX line: the server fetches the day rate when the rate is missing. A user-given rate wins.
- Not now: Num (document number), reconcile state.

## Phases
| Phase | Content | Status |
|---|---|---|
| F0 Cleanup | Rules, docs, glossary. Menu: Hesap Planı · Yevmiye · Raporlar · Ayarlar (Rehber added in D1). Hide convenience routes. | Done 2026-10-08 |
| F1 Schema | Currency on every account (income/expense get the base currency). Owner optional. `accounts.code` unique per group. Template codes. | Done 2026-10-08 |
| F2 `journal-post` | One generic function: create, update, delete an entry from a line list. Balance check, row locks, rate lookup. | Done 2026-10-08 |
| F3 Chart of Accounts | Tree table: code · name · type · currency · balance (with subtree). Add, edit, move, archive. Placeholder. | Done 2026-10-08 |
| F4 General Journal | All entries by date with their lines. Inline multi-line entry form: account search (code or name), debit, credit, memo. Live difference. Keyboard entry. | Done 2026-10-08 |
| F5 Account Register | One account's lines with the other account and a running balance. New/edit with the journal form, first line prefilled. | Done 2026-10-08 |
| F6 Reports | Trial balance, balance sheet, income statement. Date range. Base currency. | Done 2026-10-08 |
| Q1 Quick transactions | Sidebar button "Hızlı İşlem": Gelir · Gider (split to several accounts) · Transfer (between accounts, ATM withdrawal, ATM deposit; optional fee line). Different currencies: a second amount, day rate suggested. Posts a plain entry through `journal-post`; edit in the General Journal. Refund: later. | Done 2026-10-08 |
| D1 Rehber | Directory back in the menu on the ledger core: person, brand, business/institution; contact and IBAN data; default income and expense account per contact, filled in Quick Transaction. `journal-post` lines take `contact_id`; Journal and Register show the contact. Open balance from receivable/payable lines. | Done 2026-10-08 |
| S1 Simple chart | Five locked roots; locked groups Nakit, Banka, Yatırım, Duran Varlıklar, Kredi Kartı, Krediler; single accounts Kişilerden Alacaklar and Kişilere Borçlar. New account = name + group. Codes hidden. About 40 free categories. | Done 2026-10-08 |
| H1 Ana Sayfa | Menu item "Ana Sayfa" (`/anasayfa`, default route). Scope switch Aile/Topluluk · Bireysel, period switch bu ay · bu yıl. Cards (assets, liabilities, net worth, income, expense, net result), expense and income pies, 6-month income/expense bars, group tables. RPC `dashboard_totals`, `dashboard_monthly`. Individual = balance sheet accounts the member owns + income/expense entries the member posted. | Done 2026-10-08 |
| C1 Cleanup | Hidden flows deleted: legacy quick entry, 17 Edge Functions, pages, unused UI/i18n; migration `20261008110000_drop_hidden_flows` drops their tables. The sidebar button "+ Hızlı Kayıt" opens a dialog with Gider · Gelir · Transfer tabs. | Done 2026-10-08 |
| S2 Hesaplar UI | Chart of Accounts redesigned on ReUI: two-row KPI strip, tree data-grid, detail panel, right-click menu, same-name accounts of different owners folded with avatars, new account dialog on cascader. | Done 2026-10-11 |
| Later | Rebuild convenience flows on `journal-post`. Num, reconcile, scheduled entries, FX revaluation. | |

Each phase ends with: migration + deploy (if any), `npm run lint && npm run build`, a Playwright screenshot, one commit.
