---
owner: product-designer
status: active
---

# UI

Screens, components and style. Flow decisions come from [ux](../ux/README.md); data comes from the API ([backend](../../backend/README.md)). Desktop only; calm, dense ledger screens.

## Conventions
- Base: ReUI on shadcn `base-nova` (Base UI). Config `components.json` (registry `@reui`). Before any UI work call the ReUI MCP `get_agent_skill`; check with `validate_usage` and `get_audit_checklist` before finishing.
- Install: `npx shadcn@latest add @reui/<name> --yes` (ReUI item) or `add <name> --yes` (generic control). Find items with the ReUI MCP (`search`, `compose_page`); the first use needs `/mcp` → `reui` → Authenticate.
- Installed ReUI parts live in `src/ui/components/reui/` (`data-grid`, `frame`, `badge`, `cascader`, `alert`). Remove unused registry files after an install. Do not install `c-data-grid-9`: it overwrites `data-grid-table.tsx`.
- Grids page in SQL (`useServerPages`, `lib/grid.ts`). Cap loading skeletons at 10 rows.
- Number and date format: `useBook().fmt` and `useFormat()` (`lib/format.ts`). Never call `toLocale*` with `i18n.language`.
- Measure speed on `npx vite build && npx vite preview`, not on the dev server.

- Check every UI change in a browser (`playwright-cli`): light and dark mode, then close the session.
- The UI calls named API operations only, never SQL.
- Feedback goes through `notify` (`lib/notify.ts`) only; pages never import the toast component. A write op uses `useWrite(op)`: one toast runs → done or failed, text from `ops.<op>` in `i18n`. A form that shows its error inline passes `{ inline: true }`, so the error is not shown twice. Other results: `notify.success/info/warning/error`.
