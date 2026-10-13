---
paths:
  - "CLAUDE.md"
  - "docs/**/*.md"
  - ".claude/**/*.md"
---

# Writing rules

Goal: text that a person or an agent understands in one read, with few tokens.

## Language
- `docs/ux/**` is Turkish: the owner reads and discusses it. Everything else is English: `CLAUDE.md`, other docs, `.claude/**`, code, comments, commits.
- UI text lives in `src/ui/i18n/`. Use accounting terms from the product rules in `CLAUDE.md`.

## Style
- Short, active, concrete sentences. One instruction per sentence; imperative for procedures.
- One term per concept. Pick it once and keep it. Do not rotate synonyms.
- Prefer a table or list to a paragraph. State the current truth; git keeps history.
- A diagram only when it replaces prose: Mermaid `flowchart TD`, short labels.

## Structure
- One topic per file. Split a file that passes ~200 lines. A folder with more than three docs has a `README.md` index.
- Link, do not copy. Keep a fact in one file and link to it. Use relative Markdown links, never `[[wikilinks]]`.
- Size guides: `CLAUDE.md` ≤60 lines, an agent definition ≤60 lines, a skill ≤100 lines.
- Docs hold what code cannot say: decisions, reasons, flows. Do not describe structure the code shows; point to the file.

## Frontmatter (files under `docs/`)
```yaml
---
owner: product-designer  # an agent name, or "main"
status: active       # active | frozen
---
```
Agents: `product-lead`, `product-designer`, `backend-engineer`. The owner edits the file; others propose changes (see [agent rules](agents.md)). Do not read `archive/` or `arsiv/` unless asked.
