---
name: feedback-doc-system
description: "Doc/agent system the user chose 2026-10-07: docs/code English (docs/ux Turkish); STE style; relative links; owner frontmatter; agent learning loop"
metadata:
  type: feedback
---

User wants token-efficient, simple docs and coordinated, self-learning agents. Decided 2026-10-07:
- Language: user-facing docs (`docs/ux/**`) Turkish; all other files and content English. Chat replies stay Turkish.
- Style: ASD-STE100 principles (short sentences, one term per concept), not full STE compliance.
- Links: relative Markdown links, not `[[wikilinks]]`. Obsidian vault = `docs/` only (`docs/.obsidian/app.json` in git).
- No knowledge-graph DB for now; links + frontmatter are the graph.
- Rules live in `.claude/rules/writing.md` and `.claude/rules/agents.md` (path-scoped). Agents use `memory: project` and the learning loop there.

**Why:** User asked for wiki-style short docs, Obsidian, Mermaid, STE and agent coordination; we kept the cheap parts and rejected the graph DB.
**How to apply:** Follow those rule files when writing docs or creating an agent. Register new agents in `docs/README.md`.
