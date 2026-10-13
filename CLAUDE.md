# aa-finance

Professional personal-finance app with double-entry bookkeeping, modeled on GnuCash. Local and private: one SQLite file on the user's device. Users know accounting and want detailed tracking. Docs index: [docs/README.md](docs/README.md). Terms: [docs/GLOSSARY.md](docs/GLOSSARY.md). Plan: [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack
- Tauri 2 (desktop only, no mobile or tablet layout) + SQLite (WAL) + TypeScript. UI: React + Vite + Tailwind, base **ReUI** (`@reui` registry, MCP `reui`) on shadcn `base-nova` (Base UI).
- `src/core/`: pure TypeScript (rules, SQL, named API operations, tests). Never imports UI or Tauri code. `src/ui/`: pages and components. `src-tauri/`: thin Rust (`db_query`, `db_batch`, backup).
- Details: [docs/backend/local-first.md](docs/backend/local-first.md). Commands and machine notes: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Dev machine: WSL2 Ubuntu 24.04 (bash); the repo lives in `~/aa-finance`, not on `/mnt/c`. Package manager: npm.
- `archive/` holds the retired Supabase version (`web/`, `supabase/`, seed scripts). Do not edit or read it unless the user asks. Tag `supabase-final` marks the last Supabase commit.

## Product rules
- Ledger core first: Chart of Accounts, General Journal, Account Register, Reports. Judge every feature against this core.
- Follow accounting standards. The UI uses real accounting terms (Yevmiye, Hesap Planı, Borç/Alacak, Mizan, Bilanço). The chart is simple: five locked roots (Varlık, Borç, Özkaynak, Gelir, Gider), locked system groups, free accounts below. The UI hides account codes.
- Every journal entry: ≥2 lines, total debit = total credit (`base_amount`). A DB trigger enforces it; the API also validates it.
- Every account has a currency. Rates are manual: a user-given rate wins, else the stored rate on or before the entry date, else `rate_missing`.
- A journal entry is a completed event only. Plans and reminders are not entries.
- One ledger file = one family. Members have a role: `admin` manages members and book settings and edits any entry; `member` edits only own entries. Everyone reads everything. No PIN or sign-in.
- Number and date format follow the book country; the UI language only picks the words.
- Entry flows: Gider, Gelir, Transfer, Borç (Quick Entry dialog → `entries.post`) and Serbest kayıt (journal editor). Rebuild other flows one UX scenario at a time, starting from `docs/ux/`.
- Out of scope: AI/auto-fill, bank import, notifications, bills/subscriptions, sync, mobile.

## Engineering rules
- Money: safe-integer `number` in minor units (never float). Rates: text. Dates: `YYYY-MM-DD`.
- The database enforces the rules (triggers, stable error codes). The API checks first, only for clear messages. The UI calls only named API operations, never SQL.
- Never edit an applied migration. Add `src/core/migrations/NNNN_name.sql`.
- Both logs live in the SQLite file: `audit_log` (triggers: who changed a row) and `activity_log` (API: who did what).
- Minimum check after a change: `npm test && npx tsc --noEmit && npm run lint`; after UI text: `npm run check:terms`.
- Secrets: none in v1. If a token is needed, keep it in the gitignored root `.env`, load it per command, never print or commit it.
- Git: commit by default; push only when asked (the remote is a local path).

## Docs and agents
- Language: English for docs and code. UI text: Turkish and English in `src/ui/i18n/`. `docs/ux/**` (Turkish) is the flow set, one scenario per file.
- Docs are grouped by role: `docs/ux/` (UX), `docs/ui/` (UI), `docs/backend/` (Backend), shared files in `docs/`. Each role has an agent in `.claude/agents/`; `product-lead` splits a multi-role request into briefs. Ownership: [docs/README.md](docs/README.md).
- Writing rules: `.claude/rules/writing.md`. Agent rules: `.claude/rules/agents.md`. UI rules: `.claude/rules/ui.md`.
- Skills load from the request; the user does not type slash commands. Any `src/ui/` work (page, dialog, form, table, style, UI text): load `aa-finance-ui` and `reui` first and follow their workflow. Browser check: `playwright-cli`. Review or audit: `ponytail-review` / `ponytail-audit`.

## graphify
A knowledge graph lives in `graphify-out/` (rebuildable, not in git).
- For codebase questions run `graphify query "<question>"` first; use `graphify path "<A>" "<B>"` and `graphify explain "<concept>"` for relations. Read `GRAPH_REPORT.md` only for a broad architecture review.
- After code changes run `graphify update .` (AST only, no API cost).
- `/graphify` runs the skill in `.claude/skills/graphify/SKILL.md`.
