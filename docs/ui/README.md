---
owner: ui-designer
status: active
---

# UI

Screens, components and style. Flow decisions come from [ux](../ux/README.md); data comes from the API ([backend](../backend/README.md)).

| Source | Content |
|---|---|
| [ui.md rules](../../.claude/rules/ui.md) | ReUI design core. Loads when you edit `src/ui/`. |
| [aa-finance-ui skill](../../.claude/skills/aa-finance-ui/SKILL.md) | Project layer: desktop, calm, dense ledger screens. |

## Conventions
- Base: ReUI on shadcn `base-nova` (Base UI). Config `components.json` (registry `@reui`). Rules: [aa-finance-ui skill](../../.claude/skills/aa-finance-ui/SKILL.md), `.claude/skills/reui`, `.claude/rules/ui.md`.
- Install: `npx shadcn@latest add @reui/<name> --yes` (ReUI item) or `add <name> --yes` (generic control). Find items with the ReUI MCP (`search`, `compose_page`); the first use needs `/mcp` → `reui` → Authenticate.
- ReUI skill update: compare the version at the top of `.claude/skills/reui/SKILL.md` with MCP `get_agent_skill`. If newer, run `curl -fsSL https://mcp.reui.io/install | REUI_AGENTS_MD=0 node -`.
- Installed ReUI parts live in `src/ui/components/reui/` (`data-grid`, `frame`, `badge`, `cascader`, `alert`). Remove unused registry files after an install. Do not install `c-data-grid-9`: it overwrites `data-grid-table.tsx`.
- Grids page in SQL (`useServerPages`, `lib/grid.ts`). Cap loading skeletons at 10 rows.
- Number and date format: `useBook().fmt` and `useFormat()` (`lib/format.ts`). Never call `toLocale*` with `i18n.language`.
- Measure speed on `npx vite build && npx vite preview`, not on the dev server.

- Check every UI change in a browser (`playwright-cli` skill): light and dark mode, then close the session.
- The UI calls named API operations only, never SQL.
