---
name: feedback-reui-base-auto-skills
description: "2026-10-11 owner: ReUI (reui.io) is the UI base instead of plain shadcn; skills must trigger automatically, never by slash command"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1c14e92d-5031-44e2-9c81-1e18ffca7463
  modified: 2026-10-11T11:23:40.832Z
---

The owner wants reui.io as the UI base, not plain shadcn, and wants skills and agents picked automatically from the request ("Manual olarak Skill tetiklemek istemiyorum").

Done 2026-10-11: shadcn MCP and the nested `web/.claude/skills` (shadcn, migrate-radix-to-base) removed; `aa-finance-ui` rewritten as a project layer over the `reui` skill; `.claude/rules/ui.md` holds the ReUI installer's design-core block (path-scoped to `web/src/**`); CLAUDE.md says which skill loads for which request.

**Why:** one design system, one search path (ReUI MCP), no competing skills.
**How to apply:** on any `web/` UI request, load `aa-finance-ui` + `reui` without being asked and follow the ReUI loop. Do not tell the owner to type a slash command. The ReUI installer (`curl … | node -`) was blocked by the auto-mode classifier; update the skill from MCP `get_agent_skill` or ask the owner to run the installer with `REUI_AGENTS_MD=0`. See [[project-hesaplar-redesign]], [[project-yevmiye-redesign]].
