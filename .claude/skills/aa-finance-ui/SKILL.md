---
name: aa-finance-ui
description: aa-finance project layer on top of the ReUI skill (desktop, calm corporate, dense ledger screens). Use for any task in src/ui/ that adds, changes, fixes or reviews a page, screen, dialog, form, table, component, layout, colour, chart or UI text, also when the request does not say "UI". Load the reui skill with it.
---

# aa-finance UI

Base: **ReUI** on shadcn `base-nova` (Base UI), Tailwind v4, Geist, Lucide. Desktop only. Tone: calm, corporate, dense. Users know accounting. The screen shows numbers first.

The `reui` skill (`.claude/skills/reui/SKILL.md`) owns the workflow, components and design rules. Load it too. This file adds only project rules. Where both apply, the stricter rule wins.

## Workflow (required order)
1. Write the ReUI UI plan in the reply (surface, archetype, container family, density, regions, states, motion).
2. Look for an installed part first: `src/ui/components/reui/` (`data-grid`, `frame`, `badge`, `cascader`), then `src/ui/components/ui/`.
3. Not installed: ReUI MCP `search` (or `compose_page` for a page). Install with `npx shadcn@latest add @reui/<name> --yes` at the repo root. A generic control (Button, Dialog, Select) installs by bare name.
4. Read the real API: `get_component`, then one `get_examples` example. Never write a prop you did not read. Check with `validate_usage`.
5. After the change: ReUI self-checks (quality, anti-patterns), `get_audit_checklist`, then at the repo root: `npx tsc --noEmit`, `npm run lint`.
6. Look at the screen in a browser (playwright-cli skill, `--browser=chromium`) in light and dark mode before you report it done.

## Project rules
- **Tables:** ReUI `data-grid` for lists and ledgers. A plain `<table>` only inside a dialog preview or a split-line editor. Long lists page in SQL with `useServerPages` (`lib/grid.ts`); reports and trees do not page. Keep the loading skeleton at ≤10 rows ([DEVELOPMENT](../../../docs/DEVELOPMENT.md#ui)).
- **Numbers:** right-aligned, `tabular-nums`, same decimals in a column, currency once per column or card. Format with `useBook().fmt` and `useFormat()`; they follow the book country.
- **Sign:** a negative value uses `text-destructive` and also shows the sign or a Borç/Alacak label. Colour never carries meaning alone.
- **Status:** ReUI `Badge` light variants (`@/components/reui/badge`). One accent colour (`primary`, calm blue).
- **Charts:** a bar chart for a time trend; `Progress` and a percentage for shares, no pie charts. At most two series colours: `--chart-2` income, `--chart-4` expense.
- **Hierarchy:** one `h1` per page (`PageHeader`, `text-xl`). One primary action per page, top right. The figure the user came for comes first.
- **Motion:** component defaults only. No entrance animation on ledger screens. A number is visible at once.
- **Keyboard:** dialogs close with Esc, forms submit with Ctrl+Enter, Tab order follows the visual order.
- **Copy:** sentence case, consistent terms, no filler and no invented numbers. UI text lives in `src/ui/i18n/` (Turkish and English).
- **Entry forms:** everyday words first, accounting detail one click deeper. Every blocking rule has a message. Save is never silently disabled.

## Not allowed
Hero sections, marketing copy, decorative illustrations, gradients, glass, glow, an icon in a tinted square, a second icon set, a second component library, a second accent colour.
