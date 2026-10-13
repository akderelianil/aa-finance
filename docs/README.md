---
owner: product-lead
status: active
---

# Docs index

Read only what the task needs. Start at the folder of your role. Shared files sit here.

| Folder | Content | Language |
|---|---|---|
| [product-designer/](product-designer/README.md) | UX flows (`ux/`), UI conventions (`ui/`), inbox | TR (ux), EN |
| [backend/](backend/README.md) | Architecture, database, API, runtime, inbox | EN |
| [inbox/](inbox/README.md) | How source notes are saved (inbox format) | EN |
| [ARCHITECTURE](ARCHITECTURE.md) | Product decisions and scope | EN |
| [ROADMAP](ROADMAP.md) | Done, now, later | EN |
| [DEVELOPMENT](DEVELOPMENT.md) | Commands, run the real app, machine notes | EN |

Project rules live in `.claude/rules/` (ECC common, typescript and react subsets). Agents, skills and hooks come from the ECC plugin; the picks are in `CLAUDE.md`.

## Obsidian
Open `docs/` as the vault. Settings in `.obsidian/app.json` keep relative Markdown links. Only `app.json` is in git.
