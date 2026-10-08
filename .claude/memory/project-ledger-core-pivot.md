---
name: project-ledger-core-pivot
description: "2026-10-08 pivot — focus on GnuCash-style double-entry core (Chart of Accounts, General Journal, Register, Reports); convenience flows hidden"
metadata:
  type: project
---

On 2026-10-08 the user reset direction: the app got too complex because early rules (lazy-user UX, no accounting terms) were wrong. The real goal is a proper double-entry accounting app adapted to personal finance, inspired by GnuCash.

Target user: niche, professional personal-finance users who KNOW accounting and want detailed tracking. Stay as close to accounting standards as possible (Turkish Tek Düzen Hesap Planı style codes on the template; FX: server fetches day rate when omitted, user may override).

Decisions:
- Convenience features (installment, loan, deposit, FX, investment, plans, wizards, directory, quick entry) are HIDDEN, code kept; rebuild later on top of one generic journal-post function.
- UI uses real accounting terms (Yevmiye, Hesap Planı, Borç/Alacak, Mizan, Bilanço). The CLAUDE.md "no accounting terms" rule is dropped.
- v1 core scope: Chart of Accounts (tree), General Journal multi-split entry, Account Register (running balance), Reports (Trial Balance, Balance Sheet, Income Statement).
- v1 is DESKTOP ONLY. No mobile/tablet layouts.
- Multi-currency like GnuCash: every account (incl. income/expense) has a currency; owner member optional on every account.
- Group/members stay but in the background (RLS kept, screens act as one ledger).
- Add account code (e.g. 100, 102, 600). Num field and reconcile state NOT wanted for now.

Status 2026-10-08: core phases done and committed (see docs/ROADMAP.md). Earlier open calls (shared chart editing, 770/780 codes) were dropped after S1 (simple chart).

**Why:** the user felt the process drifted away from the accounting core.
**How to apply:** judge every new feature against the ledger core first; supersedes the earlier lazy-user rules.
