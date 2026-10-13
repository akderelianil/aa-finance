---
name: feedback-doc-system
description: "Doc/agent system as of 2026-10-13: docs by role (product-designer, backend), 3 agents, one craft skill per agent, inboxes inside docs, everything in git"
metadata:
  type: feedback
---

User wants free, fast work now, with docs and agents that learn from the sources they share. Current state:
- **Language:** `docs/product-designer/ux/**` Turkish; everything else English. Chat stays Turkish.
- **Style:** short, active, one term per concept. No hard word limits. No glossary until pre-release ([glossary paused](project-glossary-paused.md)).
- **Links:** relative Markdown links, no `[[wikilinks]]`. Obsidian vault = `docs/`.
- **Folders:** `docs/product-designer/{ux,ui,inbox}`, `docs/backend/{architecture,database,api,runtime,inbox}`, shared files and `docs/inbox/` (product-lead) in `docs/`.
- **Agents:** `product-lead` (briefs, optional), `product-designer` (UX+UI, merged), `backend-engineer`. Only the main session delegates. Index and ownership: `docs/README.md`.
- **Learning:** one store per agent, its craft skill (`design-craft`, `backend-craft`, `product-craft`); sources come through the inbox, lessons from work go in too. All in git so it moves to another computer. Rules: `.claude/rules/agents.md`.

**Why:** the owner changes ideas fast, merged UX and UI because they interlock, and wants agents to adapt from what they read.
**How to apply:** route a shared source into the right inbox with its content (agents cannot browse). Judge `product-lead` after 2–3 real features; drop it if it adds no value over the main session. Register new agents in `docs/README.md`.
