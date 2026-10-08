---
name: ponytail-help
description: >
  Quick reference for the ponytail skills in this project. One-shot display.
  Use for /ponytail-help, "ponytail help", "how do I use ponytail".
---

# Ponytail Help

Show this card. One-shot: change nothing.

| Skill | Trigger | What it does |
|-------|---------|--------------|
| **ponytail** | `/ponytail [lite\|full\|ultra]` | Least new code that fully solves the task. Default level: `full`. Auto-loads on coding tasks. |
| **ponytail-review** | `/ponytail-review` | Review a diff: bugs, security, load, missing tests, speed, what to cut. |
| **ponytail-audit** | `/ponytail-audit` | The same review for the whole repo, ranked. |
| **ponytail-debt** | `/ponytail-debt` | List every `ponytail:` shortcut comment as a ledger. |

Levels: **lite** builds what was asked and names the smaller option. **full** is the default ladder. **ultra** also questions the request.

Stop with "stop ponytail" or "normal mode". Resume with `/ponytail`.

Source and adaptations: `.claude/skills/ponytail/SKILL.md` (Project rules section).
