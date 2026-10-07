---
paths:
  - ".claude/agents/**"
  - ".claude/agent-memory/**"
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
- Each file has one owner (frontmatter `owner`). An agent writes only the files it owns.
- To change a file you do not own, put the proposal in your final report. The main session or the owner applies it.
- Final report format: changed files (links) · open questions for the user · proposals for other owners · lessons learned.

## Learning loop
Each agent has persistent memory in `.claude/agent-memory/<name>/` (`memory: project`). The first 200 lines of its `MEMORY.md` load at start.
1. At the end of a task, record a lesson only if it is non-obvious and reusable. One line, dated, with the reason.
2. Do not record what the docs or git already hold.
3. When `MEMORY.md` passes 50 lines, distill: merge duplicates, delete stale lines.
4. A lesson that should bind every run becomes a rule. Propose it in the report. The user approves, then the main session moves it into the agent definition, a rule file or `CLAUDE.md`, and deletes it from memory.
5. A lesson that applies to all agents goes to `CLAUDE.md` or `.claude/rules/`, not to one agent's memory.
