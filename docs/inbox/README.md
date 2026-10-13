# Agent inboxes

One inbox per agent, inside the agent's docs folder (`product-lead`: this folder). The owner drops sources and lessons here; the agent reads, learns and updates its craft skill.

| Inbox | Agent | Craft skill it maintains |
|---|---|---|
| `docs/inbox/` | product-lead | `.claude/skills/product-craft/` |
| `docs/product-designer/inbox/` | product-designer | `.claude/skills/design-craft/` |
| `docs/backend/inbox/` | backend-engineer | `.claude/skills/backend-craft/` |

## Add an item
Tell the main session: "şunu <agent>'a ilet" with a link, text or note. The main session saves it as `<yyyy-mm-dd>-<slug>.md` (agents cannot browse; the file must hold the content):

```markdown
---
status: new            # new | done
from: owner            # owner | main | <agent>
source: <url or "owner note">
---
Why it matters: one line, in the owner's words.

Content: summary, key excerpts, numbers. Keep the source language.
```

One item, one idea. An item for several agents is copied to each inbox.

This README is not an item; an item has `status:` in its frontmatter.

## Process
Say "inbox'ı işle" (all agents or one). An agent also checks its inbox at the start of every task. Rules: `.claude/rules/agents.md`.
