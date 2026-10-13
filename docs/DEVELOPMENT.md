---
owner: main
status: active
---

# Development notes

Commands, machine notes and test data. Design: [ARCHITECTURE](ARCHITECTURE.md), [backend](backend/README.md), [ui](product-designer/ui/README.md).

## Commands
Run from the repo root.

| Task | Command |
|---|---|
| Core tests (`node:sqlite`, in memory) | `npm test` |
| Type check | `npx tsc --noEmit` |
| Lint (oxlint; warnings come mostly from ReUI registry code) | `npm run lint` |
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
Backend rules: [backend/README](backend/README.md#working-rules). UI rules: [ui/README](product-designer/ui/README.md).
1. Check every UI change in a browser (`playwright-cli`): light and dark mode, then close the session. Screenshots go to `.playwright-cli/` (gitignored).

## Test data
`npm run seed` writes a family book to `.dev/aa-finance.sqlite` (gitignored): Ahmet (admin), Ayşe, Fatma and Dursun, 344 entries from 2026-07-01 to 2026-09-30. It covers Gider, Gelir, Transfer, Borç and Serbest kayıt, USD and EUR, splits, fees, the Rehber, edits, deletes and an admin fix of a member entry. The script is `scripts/dev/seed-local.ts`. The Supabase demo accounts and seed scripts are retired in `archive/`.

## Before release
- Decide encryption at rest (SQLCipher) and the data folder location.
- Click through backup and restore in the real app.
- Bring back the glossary: restore `docs/GLOSSARY.md`, `scripts/check-terms.mjs` and the `check:terms` script from git history (last commit that has them: `186d57a`), then fix every hit.
- Sign and bundle: `npx tauri build`.
