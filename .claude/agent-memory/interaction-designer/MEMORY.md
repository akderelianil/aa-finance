# interaction-designer memory

Lessons only: non-obvious, reusable, one line, dated, with the reason. Rules: `.claude/rules/agents.md` (Learning loop).

- 2026-10-07: When a bank behavior is unknown, the product owner wants a hypothetical draft based on Türkiye Finans (participation bank) standards, tagged [varsayım]. Why: owner said "varsayımsal ve Türkiye Finans standartlarını araştırarak ilerle" (Anlatım 8).
- 2026-10-08: Owner decisions after Anlatım 8 live in `docs/ROADMAP.md` (owner: main), not in the inbox. Read it with harita; copy only a short summary + link into gelen-kutusu. Why: docs/ux drifted a full roadmap behind.
- 2026-10-08: The owner accepted every "(Öneri: …)" in bulk. Give each open question one concrete recommendation plus options; it will likely become the decision. Why: ROADMAP 2026-10-07 decision.
- 2026-10-08: Code can silently deviate from a decision (last card default, firm per record, last debt direction). Mark it "uygulanmadı / sapma" in harita §8 and ask; do not rewrite the decision. Why: found 3 such cases in the sync.
- 2026-10-08: To check built behavior, read the form component and its Edge Function (`supabase/functions/*`, `transaction-delete` for Undo side effects); i18n `tr.ts` gives the real UI words. Why: commit messages omit limits (edit scope, card due amount).
- 2026-10-08: `check:terms` matches banned word starts anywhere on a line, even incidental Turkish ("arka planda", "aracı kurum", "alacaksın", "içe aktarma"). Grep docs/ux with `(^|[^\p{L}])(term)` -i per folder (glob exclusions failed). Why: these slipped past a first pass.
- 2026-10-12: Owner-given keyboard maps can clash with platform norms (Shift+Tab = back vs focus back; Enter = next vs Enter adds a row). Define the key per step and context, flag the clash. Why: found both in kurulum.md.
- 2026-10-12: Local-first decisions move fast; docs/LOCAL-FIRST.md and GLOSSARY can lag the owner's latest call (members were "later", Kayıt izinleri grants dropped). Check and flag to main. Why: kurulum sync.
- 2026-10-08: Quick-entry structure changes fast (5 buttons → 4 kinds in one day). Describe entry paths in one place (harita §3-§4) and link from flows. Why: avoids rewriting every AKS on each UI change.
