---
paths:
  - "src/ui/**"
  - "components.json"
  - "index.html"
---

# UI rules

Every UI edit, follow-ups included, loads the `reui` and `aa-finance-ui` skills and follows their workflow. They hold the design rules; this file only states what binds first.

- ReUI on shadcn (Base UI) is the design system. Keep its look. Generic frontend advice (new fonts, gradients, entrance or staggered animation) does not apply.
- Use installed components (`components/ui`, `components/reui`). Never set height, radius, padding, shadow or motion on them; use `size`, `variant`, `spacing`.
- Semantic color tokens; state through `Badge` light variants. Spacing with `gap-*`. Text `text-sm` body, `text-xs` meta, nothing smaller.
- Motion: `transition-colors` on hover; never `transition-all`; no entrance animation on ledger screens.
- If `.claude/skills/reui/` is missing, call the `reui` MCP tool `get_agent_skill`.
