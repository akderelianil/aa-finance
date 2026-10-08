---
owner: main
status: active
---

# Docs index

Read only what the task needs. Follow links for detail.

| Doc | Content | Language |
|---|---|---|
| [ARCHITECTURE](ARCHITECTURE.md) | Product and data-model decisions | EN |
| [DEVELOPMENT](DEVELOPMENT.md) | Commands, machine pitfalls, status, known debt | EN |
| [ROADMAP](ROADMAP.md) | Ledger-core phases and product decisions | EN |
| [HIDDEN-FLOWS](HIDDEN-FLOWS.md) | Notes for hidden convenience flows. Read only when you rebuild one. | EN |
| [GLOSSARY](GLOSSARY.md) | One term per concept; English ↔ Turkish UI term | EN + TR |
| [ux/](ux/README.md) | Paused (2026-10-08). Everyday-process research for the hidden convenience flows. Read only when you rebuild one. | TR |

Writing and agent rules live in `.claude/rules/` (`writing.md`, `agents.md`). They load automatically when a matching file is edited.

## Agents and file ownership

| Agent | Owns | Memory |
|---|---|---|
| main session | `CLAUDE.md`, `docs/*.md`, `.claude/**`, code | auto memory |
| [interaction-designer](../.claude/agents/interaction-designer.md) | `docs/ux/**` | `.claude/agent-memory/interaction-designer/` |

## Obsidian
Open `docs/` as the vault. Settings in `.obsidian/app.json` keep relative Markdown links. Only `app.json` is in git.
