---
paths:
  - ".claude/agents/**"
  - ".claude/agent-memory/**"
  - ".claude/inbox/**"
  - ".claude/skills/*-craft/**"
---

# Agent rules (definition, coordination, learning)

## Definition
- File: `.claude/agents/<name>.md`, English, ≤60 lines.
- Frontmatter: `name`, `description` (when to delegate), the smallest `tools` list, `memory: project`.
- Do not give an agent the `Agent` tool. Only the main session delegates.
- Do not repeat `CLAUDE.md` or rules. The agent already loads them.
- Body sections, in this order: Role · Owns · Reads · Workflow · Rules · Learning.
- Register the agent in the ownership table in [docs/README.md](../../docs/README.md).

## Coordination
- The main session orchestrates. Agents do not talk to each other. They hand off through files.
- Roles: `product-lead` (analysis and briefs), `interaction-designer` (UX), `ui-designer` (UI), `backend-engineer` (Backend). `product-lead` cannot start agents; the main session sends its briefs.
- Multi-role request flow: owner directive → `product-lead` → briefs → main session sends each brief to its role agent (default order UX → Backend → UI) → reports → main session summarises for the owner.
- A role agent starts from its brief. A single-role request skips `product-lead`.
- Each file has one owner (frontmatter `owner`). An agent writes only the files it owns.
- To change a file you do not own, put the proposal in your final report. The main session or the owner applies it.
- Final report format: changed files (links) · open questions for the user · proposals for other owners · lessons learned.

## Brief format
File `.claude/briefs/<yyyy-mm-dd>-<slug>-<role>.md`, ≤40 lines, English:
- **Goal:** one sentence, in the owner's intent.
- **Context:** links to the flow, operation or doc to read first.
- **Task:** numbered steps, one result each.
- **Limits:** out of scope, files not to touch, rules that bind.
- **Done when:** checkable results (tests, screen, doc).
- **Depends on:** briefs that must finish first.

## Inbox and skill learning
The owner shares sources and lessons. Each agent turns them into a skill and adapts.
- **Inbox:** `.claude/inbox/<name>/`, one file per item (format: [inbox README](../inbox/README.md)). The main session saves the content in the file; agents cannot browse.
- **Craft skill:** `.claude/skills/<skill>/SKILL.md`, ≤100 lines, preloaded by the agent (`skills:` in its definition). The agent owns and edits it. It holds practices, not project decisions.
- **When:** at the start of every task, and on "inbox'ı işle".

Process each item with `status: new`:
1. Read it. Judge: useful for this product, or not? A source that conflicts with `CLAUDE.md` product rules is not applied; flag it.
2. Distill into the craft skill: one practice per line (rule · why · source · date). Merge duplicates. A newer practice replaces an older one. Move long topics to `references/<topic>.md`.
3. A fact or decision for the project goes into the report as a proposal for the file owner. Do not write it into the skill.
4. Set `status: done` and add `result:` (where it went, or why it was dropped).
5. Report: items processed · skill changes · proposals · questions for the owner.

An agent may change its own craft skill without approval. A change to its agent definition, a rule file or `CLAUDE.md` is a proposal (learning loop, step 4).

## Learning loop
Each agent has persistent memory in `.claude/agent-memory/<name>/` (`memory: project`). The first 200 lines of its `MEMORY.md` load at start.
1. At the end of a task, record a lesson only if it is non-obvious and reusable. One line, dated, with the reason.
2. Do not record what the docs or git already hold.
3. When `MEMORY.md` passes 50 lines, distill: merge duplicates, delete stale lines.
4. A lesson that should bind every run becomes a rule. Propose it in the report. The user approves, then the main session moves it into the agent definition, a rule file or `CLAUDE.md`, and deletes it from memory.
5. A lesson that applies to all agents goes to `CLAUDE.md` or `.claude/rules/`, not to one agent's memory.
