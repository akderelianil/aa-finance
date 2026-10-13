---
name: design-craft
description: Learned design practice for aa-finance (UX flows, information architecture, ReUI, dense ledger screens, keyboard use). Preloaded by product-designer; maintained from its inbox. Project style rules live in aa-finance-ui.
---

# design-craft

Learned practice of `product-designer`: what shared sources taught it and what it learned on tasks. The agent keeps this file (inbox: `docs/product-designer/inbox/`). Rules: `.claude/rules/agents.md` (Learning). `CLAUDE.md` product rules win over anything here.

Focus: how accounting-literate users enter, find and review money data with the fewest steps; dense desktop ledger screens, tables, forms, keyboard flow.

## Practices
One practice per line: rule · why · source · date. Source is a shared source (url or title) or `work` (learned on a task). Newer replaces older. Move a long topic to `references/<topic>.md` and link it here.

- The owner accepts a concrete "(Öneri: …)" in bulk. Give each open question one recommendation plus options. · it usually becomes the decision · work · 2026-10-08
- Code can silently deviate from a decision. Mark it "uygulanmadı / sapma" and ask; do not rewrite the decision. · found 3 such cases · work · 2026-10-08
- To check built behavior, read the page component, `src/core/api/` and `src/ui/i18n/tr.ts` (the real UI words). · commit messages omit limits · work · 2026-10-12
- Owner-given keyboard maps can clash with platform norms (Shift+Tab = back vs focus back; Enter = next vs Enter adds a row). Define the key per step and context, flag the clash. · found both in kurulum.md · work · 2026-10-12
- Decisions move fast; docs/backend/architecture/overview.md can lag. Check and flag to main. · kurulum sync · work · 2026-10-12

## Open questions
Things a source raised that need the owner's decision.

(empty)
