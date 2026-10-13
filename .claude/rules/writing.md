---
paths:
  - "CLAUDE.md"
  - "docs/**/*.md"
  - ".claude/**/*.md"
---

# Writing rules (docs, agents, rules, memory)

Single source for how this project writes text. Goal: short text, few tokens, one meaning per term.

## Language
- User-facing docs: Turkish. Today this is `docs/ux/**` (the product owner reads and discusses them).
- Everything else: English. This includes `CLAUDE.md`, other `docs/*.md`, `.claude/**`, agent memory, code, comments and commit messages.
- UI text stays in i18n files (`src/ui/i18n/`). Turkish UI terms come from [GLOSSARY](../../docs/GLOSSARY.md).

## Style (ASD-STE100 principles, both languages)
- Write one instruction per sentence. Use the imperative for procedures.
- Keep procedure sentences ≤20 words and descriptive sentences ≤25 words.
- Use the active voice. Remove filler words.
- Use one term for one concept. Take the term from the glossary. Do not use synonyms.
- A new UI concept needs a glossary row first (term + "Do not use" synonyms). `npm run check:terms` enforces the list.
- Prefer a table or a list to a paragraph.
- State the current truth only. Git keeps the history. Do not keep decision logs in a live doc.

## Structure
- One topic per file. If a file grows past ~200 lines, split it and link the parts.
- Link, do not copy. If the same fact must appear twice, keep it in one file and link to it.
- Each folder with more than three docs has an index (`README.md`).
- `CLAUDE.md` ≤60 lines. An agent definition ≤60 lines.

## Links
- Use relative Markdown links: `[text](path/file.md)` or `[text](file.md#heading)`.
- Do not use `[[wikilinks]]`. Agents open a relative path in one step; a wikilink needs a search first.
- A code path can stay in backticks. A link to a doc must be a link.

## Frontmatter (every file under `docs/`)
```yaml
---
owner: interaction-designer   # agent name, or "main" for the main session
                              # agents: product-lead, interaction-designer, ui-designer, backend-engineer
status: active                # active | frozen
---
```
- Only the owner edits a file. Others read it and propose changes in their report.
- A `frozen` file does not change. Move it to an `arsiv/` (Turkish area) or `archive/` folder.
- Do not read files in `arsiv/` or `archive/` unless the user asks.

## Diagrams
- Use Mermaid only when the diagram replaces prose. Do not describe the same flow in text and in a diagram.
- Use `flowchart TD` for processes. Keep node labels short.
