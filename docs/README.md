---
owner: product-lead
status: active
---

# Docs index

Read only what the task needs. Start at the folder of your role. Shared files sit here.

| Folder | Content | Language |
|---|---|---|
| [foundation/](foundation/README.md) | Vision, owner interview, audit, backlog (authority for the rebuild) | EN |
| [product-designer/](product-designer/README.md) | UX flows (`ux/`), UI conventions (`ui/`), inbox | TR (ux), EN |
| [backend/specs/](backend/specs/README.md) | Behavior specs of the prototype (requirements for the rebuild) | EN |
| [legacy/docs/](../legacy/docs/backend/README.md) | Prototype design, database, API, runtime, commands (frozen) | EN |
| [inbox/](inbox/README.md) | How source notes are saved (inbox format) | EN |
| [ARCHITECTURE](ARCHITECTURE.md) | Product decisions and scope | EN |
| [RULES-TRACE](RULES-TRACE.md) | Product rule -> enforcement -> test; behavior specs in `backend/specs/` | EN |
| [adr/](adr/README.md) | Architecture decision records | EN |
| [ROADMAP](ROADMAP.md) | Done, now, later | EN |

Project rules live in `.claude/rules/` (ECC common, typescript and react subsets). Agents, skills and hooks come from the ECC plugin; the picks are in `CLAUDE.md`.

## Obsidian
Open `docs/` as the vault. Settings in `.obsidian/app.json` keep relative Markdown links. Only `app.json` is in git.
