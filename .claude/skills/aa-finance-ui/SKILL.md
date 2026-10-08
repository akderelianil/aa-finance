---
name: aa-finance-ui
description: Design rules for aa-finance web UI (desktop, calm corporate, dense ledger screens). Use for any task that adds or changes a page, component, layout, colour or chart in web/. Combines shadcn workflow with anti-AI-slop rules adapted from taste-skill.
---

# aa-finance UI

Stack: shadcn `base-nova` (Base UI), Tailwind v4, Geist, Lucide. Desktop only. Tone: calm, corporate, dense. Users know accounting. The screen shows numbers first.

## Workflow (required order)
1. `npx shadcn@latest info --json` (or MCP `get_project_registries`) to read the project config.
2. Search before you build: MCP `search_items_in_registries`, then `view_items_in_registries` and `get_item_examples_from_registries`. CLI: `npx shadcn@latest docs <component>`.
3. Add with `npx shadcn@latest add <name>`. Preview an update with `add <name> --dry-run` or `--diff`. Never hand-copy component code.
4. Follow the shadcn skill rules (`web/.claude/skills/shadcn`): semantic tokens, `FieldGroup`/`Field`, `Empty`, `Skeleton`, `Alert`, `Badge`, `Separator`, no `space-*`, no colour or type overrides through `className`.
5. After the change run MCP `get_audit_checklist`, then `npx tsc -b`, `npx oxlint`, `npm run check:terms`.
6. Look at the screen in a browser (playwright-cli skill) in light and dark mode before you report it done.

## Look
- One accent colour (`primary`, calm blue). Status colours (`success`, `destructive`, `warning`) mark the sign or state of a value. Never decorate with them.
- Neutral surfaces. No pure black or white text on large areas. No gradients, glass, glow, or coloured shadows.
- One radius system: the `--radius` token. Do not set `rounded-*` per element. Cards have no shadow; the 1px ring is the edge.
- No icon in a tinted square. Use an icon only when it adds meaning: a button, a nav item, a status. Lucide only; no emoji.
- Use a Card only to group related content. Inside a card, separate parts with a divider (`divide-*`, `Separator`), not nested cards.
- Do not repeat the same card layout three times in a row. Group figures in one strip or table.

## Numbers and tables
- Money and quantities: right-aligned, `tabular-nums`, same decimals in a column, currency once per column or card.
- A negative value uses `text-destructive`. Colour never carries meaning alone: also show the sign or a label (Borç/Alacak).
- Tables use the `Table` component, compact rows, one header row, no zebra and no boxes around rows.
- Show shares with `Progress` (thin) and a plain percentage, not pie charts. Use a bar chart for a time trend. Maximum two chart series colours: `--chart-2` income, `--chart-4` expense.
- Dates and amounts keep one format per screen (`formatAmount`, `Intl`).

## Hierarchy and layout
- One `h1` per page (`PageHeader`, `text-xl`). One primary action per page, top right.
- Content order: the figure the user came for first, detail second. Fixed grid (2 or 3 columns); no asymmetric or bento layouts.
- Spacing scale: `gap-4` between blocks, card padding from the card token. Do not add one-off margins.
- Copy: sentence case, real accounting terms from [GLOSSARY](../../../docs/GLOSSARY.md), no filler and no invented numbers.

## States and accessibility
- Every data block has loading (`Skeleton` with the final size), empty (`Empty` with the next step) and error states.
- Text contrast WCAG AA in both themes. Visible focus ring (the default token). Every icon-only control has an `aria-label`.
- Motion: only the component defaults (hover, press, dialog). No scroll animation, no entry animation. A number is visible at once.
- Keyboard first: dialogs close with Esc, forms submit with Enter, Tab order follows the visual order.

## Not allowed
Hero sections, marketing copy, decorative illustrations, gradient text, glassmorphism, auto-play motion, a second icon set, a second component library, a second accent colour.

Source of the anti-slop checklist: [taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT). Its landing-page rules (hero, bento, scroll motion, serif display) are excluded on purpose.
