---
name: project-x1-setup
description: X1 first flow = first-run setup (onboarding) + members; product-owner decisions 2026-10-12
metadata:
  node_type: memory
  type: project
  originSessionId: 3dd8d056-f07d-419b-b482-4c9555181de8
  modified: 2026-10-12T14:44:04.243Z
---

X1 started 2026-10-12 with the first-run setup flow; X1a–X1d done the same day. Phases: X1a `docs/ux/kurulum.md`, X1b migration 0003 + core ops + tests, X1c onboarding UI, X1d sidebar member menu + Settings Üyeler card.

User decisions (overrides L4 "one profile, no sign-in"):
- One ledger file = one family; many members (`actors` + `role` admin/member + `color`). First user = admin. Profile name becomes `group_name` setting; new `country` setting.
- No PIN, no biometrics (user chose this after the critique that PIN without encryption is not security).
- Rights: everyone reads; member edits own (`created_by`), admin edits all; admin manages members. No member_access grants.
- App opens with the last member (localStorage), switch from sidebar.
- 6-step onboarding: Ülke (prefills lang/currency/format) → Dil+para birimi → Sen → Aile/Topluluk (group name + members) → Hesap planı cards (Temel/Önerilen, more templates later) → Özet. Light gamification only (step bar, icons, ≤200 ms, done moment). Fully keyboard operable.
- After setup → Hesaplar (no checklist). Opening balances and restore are NOT in setup.

Open after X1d (2026-10-12):
- Country → date/number format: `country` is saved, formatting still follows the language.
- Journal: show who wrote an entry; hide Edit/Delete on others' entries for a member (today the API answers `entry_not_owner`).
- Ask the user: book settings (lock date, language, activity log days) admin only? I recommended yes for the lock date.
- Not clicked in the real Tauri app yet. CLAUDE.md access rule still describes Supabase `member_access`; left as is.
- Next X1 flow: entry (Hızlı Kayıt). Start by asking the user to narrate how they use it today.

**Why:** user wants a family-oriented, keyboard-first, fast-feeling onboarding.
**How to apply:** Next X1 flows (entry, edit, find, report) follow the same loop: user narrates first, then critique + options. See [[project-local-first-pivot]], [[feedback-ux-focus]], [[feedback-working-style]].
