---
paths:
  - ".claude/agents/**"
  - ".claude/agent-memory/**"
  - ".claude/inbox/**"
  - ".claude/skills/*-craft/**"
---

# Agent rules

## Roles
| Agent | Role |
|---|---|
| `product-lead` | Analyses a directive, splits it by role, writes briefs. Cannot start agents. |
| `interaction-designer` | UX flows (`docs/ux/`) |
| `ui-designer` | Screens (`src/ui/`) |
| `backend-engineer` | Rules, database, API (`src/core/`, `src-tauri/`) |

Ownership table: [docs/README.md](../../docs/README.md). A single-role request goes straight to the role agent. A multi-role request goes through `product-lead`; the main session then sends each brief (default order UX → Backend → UI).

## Definition
- File `.claude/agents/<name>.md`, English, ≤60 lines. Frontmatter: `name`, `description` (when to delegate), the smallest `tools` list, `memory: project`, `skills` (its craft skill).
- Sections: Role · Owns · Reads · Workflow · Rules · Learning. Do not repeat `CLAUDE.md` or rules.
- Only the main session delegates. No agent gets the `Agent` tool.

## Working together
- Agents do not talk to each other. They hand off through files and reports.
- An agent edits the files it owns. For a file it does not own, a change that its own task needs and that carries no decision (a link, a message key, a rename) is allowed: list it in the report. A change that carries a decision is a proposal in the report.
- Report: changed files · open questions for the owner · proposals · lessons.
- **Brief** (`.claude/briefs/<date>-<slug>-<role>.md`, ≤40 lines): Goal · Context (links) · Task (numbered) · Limits · Done when · Depends on.

## Learning
Two stores, two jobs:
- **Memory** (`.claude/agent-memory/<name>/MEMORY.md`): lessons from working here. One line, dated, with the reason. Skip what docs or git hold. Distill past 50 lines.
- **Craft skill** (`.claude/skills/<skill>/SKILL.md`): practice learned from sources the owner shares. Practices only, not project decisions.

**Inbox** (`.claude/inbox/<name>/`, format in the [inbox README](../inbox/README.md)): the main session saves a shared source with its content, because agents cannot browse. Process items with `status: new` at the start of a task and on "inbox'ı işle":
1. Judge it for this product. A source that conflicts with the `CLAUDE.md` product rules is flagged, not applied.
2. Distill into the craft skill: rule · why · source · date. Merge duplicates; newer replaces older; long topics go to `references/`.
3. A project fact or decision goes to the report as a proposal. Do not store it in the skill.
4. Set `status: done` and `result:` (where it went, or why it was dropped).

An agent changes its own memory and craft skill freely. A lesson that should bind every run, or that applies to all agents, is proposed in the report; after approval the main session moves it into an agent definition, a rule file or `CLAUDE.md`.
