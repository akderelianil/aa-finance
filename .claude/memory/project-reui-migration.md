---
name: project-reui-migration
description: "2026-10-11 ReUI migration of remaining old-style screens: item checklist and the clear-between-items routine"
metadata:
  type: project
---

Plan file: `~/.claude/plans/mossy-snuggling-kitten.md`. One item per session, one commit each; after an item say "run /clear, then `devam`". On `devam`: read this note, load `aa-finance-ui` + `reui`, do the next unchecked item.

Checklist (mark done here after each commit):
- [x] 0 `components/DataState.tsx` + `state.*` i18n
- [x] 1 AccountRegister → data-grid
- [x] 2 Reports → data-grid
- [x] 3 MemberAccessCard (drop ui/table; table.tsx deleted)
- [x] 4 Directory (Rehber)
- [x] 5 Dashboard + StatStrip
- [x] 6 Settings (save toasts, no-op Save disabled, admin tools card)
- [ ] 7 Auth + onboarding (low priority)
- [ ] 8 Sweep unused shadcn parts + docs

**Why:** owner wants every screen on the ReUI rules with better UX, low token use per session.
**How to apply:** see [[feedback-reui-base-auto-skills]]. Out of scope: cascader replacement, journal-post 500.
