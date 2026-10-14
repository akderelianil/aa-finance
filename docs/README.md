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
| [foundation/ci](foundation/ci.md) | Continuous integration policy: what runs when, and what changes when the repository is public | EN |
| [foundation/test-catalog](foundation/test-catalog.md) | Every Rust test by topic, generated from the sources (`npm run test:catalog`) | EN |

Project rules live in `.claude/rules/` (ECC common, typescript and react subsets). Agents, skills and hooks come from the ECC plugin; which tool to use when is in [foundation/ecc-usage.md](foundation/ecc-usage.md).

## Obsidian
Open `docs/` as the vault. Settings in `.obsidian/app.json` keep relative Markdown links. Only `app.json` is in git.
