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
| Q1 Quick Entry | Sidebar button "Hızlı Kayıt": Gelir · Gider (split to several accounts) · Transfer (between accounts, ATM withdrawal, ATM deposit; optional fee line). Different currencies: a second amount, day rate suggested. Posts a plain entry through `journal-post`; edit in the General Journal. Refund: later. | Done 2026-10-08 |
| D1 Rehber | Directory back in the menu on the ledger core: person, brand, business/institution; contact and IBAN data; default income and expense account per contact, filled in Quick Transaction. `journal-post` lines take `contact_id`; Journal and Register show the contact. Open balance from receivable/payable lines. | Done 2026-10-08 |
| S1 Simple chart | Five locked roots; locked groups Nakit, Banka, Yatırım, Duran Varlıklar, Kredi Kartı, Krediler; single accounts Kişilerden Alacaklar and Kişilere Borçlar. New account = name + group. Codes hidden. About 40 free categories. | Done 2026-10-08 |
| H1 Ana Sayfa | Menu item "Ana Sayfa" (`/anasayfa`, default route). Scope switch Aile/Topluluk · Bireysel, period switch bu ay · bu yıl. Cards (assets, liabilities, net worth, income, expense, net result), expense and income pies, 6-month income/expense bars, group tables. RPC `dashboard_totals`, `dashboard_monthly`. Individual = balance sheet accounts the member owns + income/expense entries the member posted. | Done 2026-10-08 |
| C1 Cleanup | Hidden flows deleted: legacy quick entry, 17 Edge Functions, pages, unused UI/i18n; migration `20261008110000_drop_hidden_flows` drops their tables. The sidebar button "+ Hızlı Kayıt" opens a dialog with Gider · Gelir · Transfer tabs. | Done 2026-10-08 |
| Q2 Borç | Quick Entry tab Borç: Borç Verme, Borç Alma, Tahsilat, Ödeme between people ([borc](ux/borc.md)). Open balance per contact, overpayment warning. | Done 2026-10-08 |
| S3 Core accounts | Locked core set (roots, system groups, Kişilerden Alacaklar, Kişilere Borçlar, Banka Ücreti, system accounts). Onboarding choice: core only or core + recommended. Admin adds recommended accounts later on Hesaplar. | Done 2026-10-11 |
| S2 Hesaplar UI | Chart of Accounts redesigned on ReUI: two-row KPI strip, tree data-grid, detail panel, right-click menu, same-name accounts of different owners folded with avatars, new account dialog on cascader. | Done 2026-10-11 |
| J2 Yevmiye UI | General Journal on ReUI data-grid: one row per entry, lines on expand, period presets. "Yeni kayıt" chooser (Gider, Gelir, Transfer, Borç, Serbest kayıt). Defensive entry forms with guiding messages. | Done 2026-10-11 |
| U1 ReUI migration | Register, Reports, Member access, Directory, Dashboard, Settings, Auth and onboarding moved to ReUI: data-grid tables, shared `DataState` (loading, empty with action, error with Retry), Alert and RadioGroup in forms. Unused shadcn parts removed. | Done 2026-10-11 |
| M1 Member switch | Sidebar group menu lists members with the caller's right (Sen, Yönetici, Görür, Düzeltir, Siler). Another member selected: Journal shows their entries; new entries are booked in their name with `edit` access (`journal-post` `member_id`), otherwise view only. | Done 2026-10-12 |
| A1 Audit fixes | Entry edit/delete scoped to the caller's group. Edge Functions on the transaction pooler (`DB_POOL_URL`), JWT checked locally (`getClaims`). Journal and Register page past 1000 rows. TCMB rate saved under its publish date. RLS via `my_group_id()`. Private avatars (signed URLs). Unused packages, tables and the attachments bucket removed. | Done 2026-10-12 |
| P1 Grid speed | Loading skeletons capped at 10 rows (Reports first visit 7 s → 0.4 s, Journal 3.7 s → 0.5 s). Client-side pages in Journal and Register. | Done 2026-10-12 |
| L0 Spike | Tauri 2 shell, Rust `db_query` and `db_batch`, SQLite file, migration runner (`user_version`), Node test adapter. Check IPC cost and bigint. See [LOCAL-FIRST](LOCAL-FIRST.md). | Done 2026-10-12 |
| L1 Schema | Tables, triggers, indexes, template data. Trigger tests on in-memory SQLite. | Done 2026-10-12 |
| L2 Core API | Services and read queries behind named JSON operations. Tests first. | Done 2026-10-12 |
| L3 UI | Chart of Accounts, General Journal, Account Register, Reports, Quick Entry on ReUI with SQL paging. Sidebar Quick Entry opens a chooser first (Gider, Gelir, Transfer, Borç, Serbest kayıt); General Journal "Yeni kayıt" opens the free entry. Steps: L3a shell and setup, L3b Chart of Accounts, L3c General Journal and entry editor with history, L3d Account Register, L3e Reports, L3f Quick Entry, L3g Settings and Exchange Rates. | Done 2026-10-12 |
| L4 Profile and backup | Profile name in Settings (the local user actor). Data card: back up now (save dialog), daily automatic backup (last 10 days), restore from a backup (current data copied first), JSON export of all tables. Activity page (who did what). `npm run bench` on 10k entries. | Done 2026-10-12 |
| X1 User flows | In progress. Review and rework the user flows one at a time with the product owner; focus is UX/UI. Order: setup, then entry, edit, find, report. Setup ([kurulum](ux/kurulum.md)) done 2026-10-12: X1a UX doc, X1b members schema (`0003`) and core ops, X1c 6-step keyboard onboarding, X1d sidebar member menu and Settings Üyeler card. Next: entry flow. | |
| Later | Rebuild convenience flows on `journal-post`. Num, reconcile, scheduled entries, FX revaluation. | |

Each phase ends with: migration + deploy (if any), `npm run lint && npm run build`, a Playwright screenshot, one commit.
