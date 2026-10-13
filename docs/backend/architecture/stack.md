---
owner: backend-engineer
status: active
---

# Stack

Technologies in use. Versions come from `package.json` and `src-tauri/Cargo.toml`; check there for exact numbers. Layout and adapters: [overview](overview.md#stack). Commands: [DEVELOPMENT](../../DEVELOPMENT.md).

## App shell and data
| Part | Technology | Role |
|---|---|---|
| Shell | Tauri 2 | Desktop window (WebView) and file access. Desktop only. |
| Native code | Rust: `rusqlite` (bundled SQLite, `backup` feature), `serde`, `tauri-plugin-dialog` | Thin bridge: `db_query`, `db_batch`, backup files, save dialog. |
| Database | SQLite, WAL mode | One file per ledger. Triggers enforce the rules. No ORM. |
| Core language | TypeScript 6 | Pure code in `src/core/`: rules, SQL, API operations. |
| Validation | Zod 4 (`zod/mini`) | API input schemas. |

## UI
| Part | Technology | Role |
|---|---|---|
| Framework | React 19, Vite 8 | Pages and build. |
| Design system | ReUI on shadcn `base-nova`, Base UI | Components in `src/ui/components/`. |
| Style | Tailwind CSS 4, `tw-animate-css`, Geist font, Lucide icons | Tokens and utilities. |
| Data | TanStack Query 5 | Reads and writes through `src/ui/lib/api.ts`. |
| Tables | TanStack Table 9 | Under ReUI `data-grid`, with SQL paging. |
| Routing | React Router 8 (`HashRouter`) | Screens inside the WebView. |
| Language | i18next, react-i18next | Turkish and English in `src/ui/i18n/`. |

## Tooling
| Part | Technology | Role |
|---|---|---|
| Package manager | npm | Node 24 on the dev machine. |
| Tests | `node:test` + `node:sqlite` | Core tests run in memory. Node is a dev tool only. |
| Type check | `tsc` | `npx tsc --noEmit`. |
| Lint | oxlint | `npm run lint`. |
| Dev in a browser | Vite plugin `scripts/dev-db.ts` | Serves a `node:sqlite` database for Playwright checks. |
| Browser checks | Playwright (`playwright-cli`) | Light and dark mode. |

## Decisions
- No ORM, no query builder, no DuckDB: plain SQL files in `src/core/`.
- `src/core/` never imports UI or Tauri code (lint rule). The UI calls named API operations only.
- No server, no sync, no network call in v1.
- A new dependency needs a reason in the task report. Prefer what is installed.
