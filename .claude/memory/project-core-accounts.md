---
name: project-core-accounts
description: "2026-10-11 Hesaplar rework — core (locked) account set decided; onboarding choice core-only vs core+recommended still to build"
metadata:
  type: project
---

Owner wants the Hesaplar (Chart of Accounts) end-user ready, with two onboarding options: (1) core + system accounts only; (2) core + recommended Gelir/Gider accounts.

Done (migration `20261011100000_core_accounts.sql`): core = every locked row = 5 roots, 6 system groups, Kişilerden Alacaklar, Kişilere Borçlar, Banka Ücreti (`bank_fee`, under Gider root), plus `system_key` accounts (Açılış Bakiyesi, Kambiyo, Menkul Kıymet), all locked at DB level. Wallet "Cüzdan - TRY" stays an unlocked starter in both options. `apply_account_template(group, p_recommended)`: false = core only.

Done 2026-10-11: onboarding radio choice (`chart`: core | recommended) → `onboarding-create-group`.

Todo: recommend-later path for existing users; polish Accounts page for end users.

**Why:** the owner called Hesaplar "very important"; the system must not break if the user edits accounts.
**How to apply:** new locked accounts go in the template with `locked = true`; recommended ones stay unlocked. See [[project-ux-reset]].
