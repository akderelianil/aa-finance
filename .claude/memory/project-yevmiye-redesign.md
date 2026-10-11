---
name: project-yevmiye-redesign
description: "2026-10-11 Yevmiye page and entry dialogs rebuilt (data-grid, icon chooser, defensive forms); owner decisions and gotchas"
metadata:
  type: project
---

Yevmiye (`web/src/pages/Journal.tsx`) was rebuilt on the ReUI data-grid with cognitive-load and progressive-disclosure rules. Commits `685bebe`, `3c58fa3`, `6b39826`, `89d283a`.

Owner decisions (feedback while testing):
- Expanded row: one Amount column with a Debit/Credit badge, aligned under the grid columns. Table columns: User (avatar + tooltip with name, expand chevron), Date, Account, Amount. One row per entry; debit/credit lines open on row click. Edit/Delete in the "⋯" row menu. Newest first. Period presets (Bu ay / Geçen ay / Bu yıl / Özel); date inputs only for "Özel".
- "Yeni kayıt" is two steps: `NewEntryChooser` (icon cards: Gider, Gelir, Transfer, Borç; "Serbest kayıt" row below) → the Quick Entry form (`QuickTransactionDialog`, reused; also the sidebar "Hızlı Kayıt"). Free entry = the `JournalEditor` grid in a dialog; editing an existing entry also uses it.
- Entry forms must be defensive: amount hero field (`AmountInput`, strips letters, shows currency, tidies on blur), inline messages, Save never silently disabled (click marks fields, focuses the first, shows a count). Rules in `web/src/lib/entryRules.ts` and the `check.*` i18n keys. Hard errors block; warnings (old date, low balance, duplicate account, big fee) do not.
- Rehber, tags, line memos, fee and split stay hidden behind "add" buttons (progressive disclosure).

**Why:** the owner found the old dialog "too technical" and wanted fewer wrong entries.
**How to apply:** new entry UI keeps this pattern: everyday words first, accounting detail one click deeper, every blocking rule has a message.

Gotchas:
- `check:terms` bans "kategori", "işlem", "giriş" in Turkish UI text (use Hesap, kayıt). Run it after every i18n edit.
- Do not truncate decimals silently ("1.234" would become 1,23); show an error instead.
- Do not install `c-data-grid-9`: it overwrites `data-grid-table.tsx`. Use `meta.expandedContent` of the installed grid.
- `playwright-cli open` needs `--browser=chromium` (no Chrome in WSL); log in with the demo account ([[reference-demo-account]]).

See [[project-hesaplar-redesign]].
