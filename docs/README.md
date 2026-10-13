---
owner: product-lead
status: active
---

# Docs index

Read only what the task needs. Start at the folder of your role.

| Role | Folder | Content | Language |
|---|---|---|---|
| UX | [ux/](ux/README.md) | Flow set, one scenario per file. Build the next scenario here first. | TR |
| UI | [ui/](ui/README.md) | Screens, components, style conventions | EN |
| Backend | [backend/](backend/README.md) | Database rules, API, ledger model, backup | EN |
| Shared | [ARCHITECTURE](ARCHITECTURE.md) | Product decisions and scope | EN |
| Shared | [ROADMAP](ROADMAP.md) | Done, now, later | EN |
| Shared | [DEVELOPMENT](DEVELOPMENT.md) | Commands, run the real app, machine notes | EN |

Writing and agent rules live in `.claude/rules/` (`writing.md`, `agents.md`, `ui.md`). They load when a matching file is edited.

## Agents and file ownership

The user talks to the main session. For a multi-role request the main session first calls `product-lead`, then sends each brief to the role agent.

| Agent | Role | Owns | Knowledge |
|---|---|---|---|
| [product-lead](../.claude/agents/product-lead.md) | Analyses a directive, splits it by role, writes briefs | `docs/README.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `.claude/briefs/**`, own inbox and `product-craft` skill | `product-craft` skill |
| [product-designer](../.claude/agents/product-designer.md) | UX + UI | `docs/ux/**`, `docs/ui/**`, `src/ui/**` | `design-craft` skill |
| [backend-engineer](../.claude/agents/backend-engineer.md) | Backend | `docs/backend/**`, `src/core/**`, `src-tauri/**`, `scripts/**` | `backend-craft` skill |
| main session | Dispatch, shared files | `CLAUDE.md`, `.claude/**` (except craft skills and inboxes), `docs/DEVELOPMENT.md` | auto memory |

## Obsidian
Open `docs/` as the vault. Settings in `.obsidian/app.json` keep relative Markdown links. Only `app.json` is in git.
