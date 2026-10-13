---
name: backend-craft
description: Learned backend practice for aa-finance (SQLite, double-entry, Tauri, testing, performance). Preloaded by backend-engineer; maintained from its inbox.
---

# backend-craft

Learned practice of `backend-engineer`: what shared sources taught it and what it learned on tasks. The agent keeps this file (inbox: `docs/backend/inbox/`). Rules: `.claude/rules/agents.md` (Learning). `CLAUDE.md` product rules win over anything here.

Focus: SQLite rules and triggers, accounting correctness, API design, Rust bridge, tests.

## Practices
One practice per line: rule · why · source · date. Source is a shared source (url or title) or `work` (learned on a task). Newer replaces older. Move a long topic to `references/<topic>.md` and link it here.

- Error messages answer three things: what happened, what the user can do, where to go. Neutral, never blaming. A stable code maps to one i18n key; the API check supplies the clear message, the trigger the code. · fintech UX guide §06 · theskinsfactory.com/definitive-fintech-ui-ux-design-guide · 2026-10-13
- Audit queries should return before/after values, actor and time in a shape the UI can show as a plain history list. · guide §16 · same · 2026-10-13
- A failure counter that must survive a failed call commits in the op's own `db.batch` before it throws; the op sets `selfLog` so `call()` does not log twice. · work · 2026-10-13
- Rows that hold secrets (PIN hash) get their own table with no audit trigger, so they never enter `audit_log` JSON. · work · 2026-10-13

## Open questions
Things a source raised that need the owner's decision.

(empty)
