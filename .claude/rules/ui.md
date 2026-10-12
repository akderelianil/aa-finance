---
paths:
  - "src/ui/**"
  - "components.json"
  - "index.html"
---

# UI rules (ReUI design core)

Every UI edit, follow-ups included, loads the `reui` and `aa-finance-ui` skills. Source of this block: the ReUI installer (`curl -fsSL https://mcp.reui.io/install | node -`, AGENTS.md block). Refresh it when the ReUI skill version changes.

This project uses an existing design system: ReUI on shadcn/ui (Base UI). Keep its look. Generic frontend advice (vary fonts or themes, gradients, page-load or staggered reveals, Framer Motion) does not apply here, and other design skills lose where they disagree.

1. Use installed components first (`components/ui`, `components/reui`): tables `data-grid`, filtering `filters`, boards `kanban`, modals `Dialog` or `AlertDialog`, toasts `sonner`. Never set height, radius, padding, shadow or motion on them; use `size`, `variant`, `spacing`.
2. Color: semantic tokens. State: `<Badge variant="success-light">` from `@/components/reui/badge` at default size, or Alert variants. Raw palette only for categorical identity, with its `dark:` pair.
3. Spacing: `gap-*` on the parent: `gap-1` to `gap-2` in a row, `gap-3` to `gap-4` between groups, `gap-6` to `gap-8` between sections. Type: `text-sm` body, `text-xs` meta, nothing smaller; never resize FrameTitle or CardTitle.
4. Motion: installed parts already animate; never retime them. Yours: hover `transition-colors`; reveal `duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]`; transform and opacity only; never `transition-all`, bounce, or a stagger on table rows or lists of 20+. aa-finance: no entrance animation on ledger screens.
5. Every data region: empty state with an action, `Skeleton` loading, inline error with Retry.
6. Before UI code, write the plan from `.claude/skills/reui/SKILL.md` in the reply. Before you finish, run its self-check on the changed files and fix every hit (2 rounds at most). If that folder is missing, call the `reui` MCP tool `get_agent_skill`.
