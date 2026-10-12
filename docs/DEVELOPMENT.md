---
owner: main
status: active
---

# Development notes

Commands, machine notes and test data. Design: [ARCHITECTURE](ARCHITECTURE.md), [LOCAL-FIRST](LOCAL-FIRST.md).

## Commands
Run from the repo root.

| Task | Command |
|---|---|
| Core tests (`node:sqlite`, in memory) | `npm test` |
| Type check | `npx tsc --noEmit` |
| Lint (oxlint; warnings come mostly from ReUI registry code) | `npm run lint` |
| UI text against the glossary | `npm run check:terms` |
| Real app with hot reload | `npm run tauri dev` |
| Release binary | `npx tauri build --no-bundle` → `src-tauri/target/release/aa-finance` |
| Plain browser dev (Playwright) | `npm run dev`, open the printed URL |
| Demo book (stop Vite first) | `npm run seed` |
| Benchmark on 10k entries | `npm run bench` |

Minimum check after a change: `npm test && npx tsc --noEmit && npm run lint`.

## Run the real app
1. `npm run tauri dev`. The first build compiles Rust and takes minutes. A window opens through WSLg.
2. The app opens the existing book at `~/.local/share/com.akdereli.aa-finance/aa-finance.sqlite`. Setup shows only on an empty book.
3. For a fresh book (setup and members) leave your data alone: `XDG_DATA_HOME=/tmp/aa-try npm run tauri dev`. Delete `/tmp/aa-try` to start again.
4. Click through: setup (6 steps, keyboard only), switch member in the sidebar menu, add entries as a member and as the admin, Settings (admin and member), backup now, restore.
5. The `libEGL` and `MESA ZINK` warnings are harmless (no GPU in WSL).

## Machine notes (Ubuntu on WSL2)
- Work in `~/aa-finance` (ext4), never on `/mnt/c`. Use npm. Files are UTF-8 with LF (`.gitattributes`).
- Tauri needs Rust (`rustup`, `~/.cargo/bin` on `PATH`) and `sudo apt install pkg-config libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev file`.
- Dependencies are new (react-router 8, tailwind 4, vite 8, i18next 26, TypeScript 6). Check current docs with context7 when unsure of syntax.
- The remote is a local path: commit, and push only when asked.

## Working rules
1. Never edit an applied migration. Add `src/core/migrations/NNNN_name.sql`.
2. Money is a safe-integer `number` in minor units. Rates are text. No float math.
3. A new rule goes into a trigger first; the API pre-checks it for a clear message. Add the error code to `src/core/api/errors.ts` and to both i18n files.
4. A new operation lives in `src/core/api/`, is listed in `index.ts`, and has a test in `api.test.ts`.
5. Check every UI change in a browser (playwright-cli skill): light and dark mode, then close the session. Screenshots go to `.playwright-cli/` (gitignored).
6. After code changes run `graphify update .`.

## UI
- Base: ReUI on shadcn `base-nova` (Base UI). Config `components.json` (registry `@reui`). Rules: [aa-finance-ui skill](../.claude/skills/aa-finance-ui/SKILL.md), `.claude/skills/reui`, `.claude/rules/ui.md`.
- Install: `npx shadcn@latest add @reui/<name> --yes` (ReUI item) or `add <name> --yes` (generic control). Find items with the ReUI MCP (`search`, `compose_page`); the first use needs `/mcp` → `reui` → Authenticate.
- ReUI skill update: compare the version at the top of `.claude/skills/reui/SKILL.md` with MCP `get_agent_skill`. If newer, run `curl -fsSL https://mcp.reui.io/install | REUI_AGENTS_MD=0 node -`.
- Installed ReUI parts live in `src/ui/components/reui/` (`data-grid`, `frame`, `badge`, `cascader`, `alert`). Remove unused registry files after an install. Do not install `c-data-grid-9`: it overwrites `data-grid-table.tsx`.
- Grids page in SQL (`useServerPages`, `lib/grid.ts`). Cap loading skeletons at 10 rows.
- Number and date format: `useBook().fmt` and `useFormat()` (`lib/format.ts`). Never call `toLocale*` with `i18n.language`.
- Measure speed on `npx vite build && npx vite preview`, not on the dev server.

## Test data
`npm run seed` writes a family book to `.dev/aa-finance.sqlite` (gitignored): Ahmet (admin), Ayşe, Fatma and Dursun, 344 entries from 2026-07-01 to 2026-09-30. It covers Gider, Gelir, Transfer, Borç and Serbest kayıt, USD and EUR, splits, fees, the Rehber, edits, deletes and an admin fix of a member entry. The script is `scripts/dev/seed-local.ts`. The Supabase demo accounts and seed scripts are retired in `archive/`.

## Before release
- Decide encryption at rest (SQLCipher) and the data folder location.
- Click through backup and restore in the real app.
- Sign and bundle: `npx tauri build`.
