# interaction-designer memory

Lessons only: non-obvious, reusable, one line, dated, with the reason. Rules: `.claude/rules/agents.md` (Learning loop).

- 2026-10-08: The owner accepts a concrete "(Öneri: …)" in bulk. Give each open question one recommendation plus options. Why: it usually becomes the decision.
- 2026-10-08: Code can silently deviate from a decision. Mark it "uygulanmadı / sapma" and ask; do not rewrite the decision. Why: found 3 such cases.
- 2026-10-12: To check built behavior, read the page component, `src/core/api/` and `src/ui/i18n/tr.ts` (the real UI words). Why: commit messages omit limits.
- 2026-10-12: Owner-given keyboard maps can clash with platform norms (Shift+Tab = back vs focus back; Enter = next vs Enter adds a row). Define the key per step and context, flag the clash. Why: found both in kurulum.md.
- 2026-10-12: Decisions move fast; docs/backend/local-first.md can lag. Check and flag to main. Why: kurulum sync.
