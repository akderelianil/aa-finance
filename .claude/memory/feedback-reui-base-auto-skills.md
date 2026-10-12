---
name: feedback-reui-base-auto-skills
description: ReUI (reui.io) is the UI base; skills load from the request, never by slash command
metadata:
  type: feedback
---

The owner wants reui.io as the UI base, not plain shadcn, and wants skills and agents picked automatically ("Manual olarak Skill tetiklemek istemiyorum").

**Why:** one design system, one search path (ReUI MCP), no competing skills.
**How to apply:** on any `src/ui/` request, load `aa-finance-ui` and `reui` without being asked and follow the ReUI loop. Never tell the owner to type a slash command. Update the ReUI skill from MCP `get_agent_skill`, or ask the owner to run the installer with `REUI_AGENTS_MD=0`.
