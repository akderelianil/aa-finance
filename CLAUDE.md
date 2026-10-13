# aa-finance

Professional personal-finance app with double-entry bookkeeping, modeled on GnuCash. Local and private: one SQLite file on the user's device. Users know accounting and want detailed tracking. Docs index: [docs/README.md](docs/README.md). Plan: [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack
- Tauri 2 (desktop only, no mobile or tablet layout) + SQLite (WAL) + TypeScript. UI: React + Vite + Tailwind, base **ReUI** (`@reui` registry, MCP `reui`) on shadcn `base-nova` (Base UI).
- `src/core/`: pure TypeScript (rules, SQL, named API operations, tests). Never imports UI or Tauri code. `src/ui/`: pages and components. `src-tauri/`: thin Rust (`db_query`, `db_batch`, backup).
- Details: [docs/backend/architecture/overview.md](docs/backend/architecture/overview.md). Decisions and why: [docs/adr/](docs/adr/README.md). Commands and machine notes: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Dev machine: WSL2 Ubuntu 24.04 (bash); the repo lives in `~/aa-finance`, not on `/mnt/c`. Package manager: npm.
- The retired Supabase version (`web/`, `supabase/`, seed scripts) is gone from `main`. Tag `supabase-final` marks the last Supabase commit; read it only if the user asks.

## Product rules
- Ledger core first: Chart of Accounts, General Journal, Account Register, Reports. Judge every feature against this core.
- Follow accounting standards. The UI uses real accounting terms (Yevmiye, Hesap Planı, Borç/Alacak, Mizan, Bilanço). The chart is simple: five locked roots (Varlık, Borç, Özkaynak, Gelir, Gider), locked system groups, free accounts below. The UI hides account codes.
- Every journal entry: ≥2 lines, total debit = total credit (`base_amount`). A DB trigger enforces it; the API also validates it.
- Every account has a currency. Rates are manual: a user-given rate wins, then a user-given base amount, else the stored rate on or before the entry date, else `rate_missing`.
- A journal entry is a completed event only. Plans and reminders are not entries.
- One ledger file = one family. Members have a role: `admin` manages members (adds, edits, removes) and book settings and edits any entry; `member` edits only own entries. Everyone reads everything. Shared data (accounts, rates, contacts) can be changed only by an admin or a member the admin granted that area (`can_manage_*`, default none); everyone reads everything ([ADR-0007](docs/adr/0007-admin-grants-for-shared-data.md)). Each member has a 6-digit PIN; the app locks on open and after 5 min idle (an app gate, not encryption; admin resets a forgotten PIN). Plan: [docs/pin-gate.md](docs/pin-gate.md).
- Number and date format follow the book country; the UI language only picks the words.
- Entry flows: Gider, Gelir, Transfer, Borç (Quick Entry dialog → `entries.post`) and Serbest kayıt (journal editor). Rebuild other flows one UX scenario at a time, starting from `docs/product-designer/ux/`.
- Out of scope: AI/auto-fill, bank import, notifications, bills/subscriptions, sync, mobile.

## Engineering rules
- Money: safe-integer `number` in minor units (never float). Rates: text. Dates: `YYYY-MM-DD`.
- The database enforces the rules (triggers, stable error codes). The API checks first, only for clear messages. The UI calls only named API operations, never SQL.
- Never edit an applied migration. Add `src/core/migrations/NNNN_name.sql`.
- Both logs live in the SQLite file: `audit_log` (triggers: who changed a row) and `activity_log` (API: who did what).
- Minimum check after a change: `npm run verify:web` (tests with a coverage floor, `tsc`, lint); add `npm run verify:rust` when `src-tauri/` changes. A pre-commit hook runs it (`npm run hooks:install`).
- Secrets: none in v1. If a token is needed, keep it in the gitignored root `.env`, load it per command, never print or commit it.
- Work tracking: `.stories/` via `ecc:story-lifecycle` (epic -> stories -> sprint). Write only through its `ledger.js`. Do not also run the GitHub-issue `epic-*` commands for the same work.
- Git: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`, `ecc:`); `npm run changelog` rebuilds `CHANGELOG.md` from them. Commit by default and push to the private `github` remote after each finished change (the owner does not want to be asked each time).

## Docs and ECC
- Language: English for docs and code; `docs/product-designer/ux/**` is Turkish (one scenario per file). UI text: Turkish and English in `src/ui/i18n/`.
- Docs are grouped by role: `docs/product-designer/ux/`, `docs/product-designer/ui/`, `docs/backend/`; shared files in `docs/`.
- Agent, skill and hook tooling is the ECC plugin (`ecc@ecc`, project scope, hook profile `standard`). Rules in `.claude/rules/` (common, typescript, react) are a lean subset of ECC's.
- Agents to use: `ecc:typescript-reviewer` and `ecc:react-reviewer` after code changes; `ecc:security-reviewer` for PIN, auth and file-access changes; `ecc:tdd-guide` for new `src/core/` logic; `ecc:rust-reviewer` for `src-tauri/`; `ecc:build-error-resolver` when tsc or the build fails; `ecc:e2e-runner` for browser flows.
- Skills to use: `ecc:tdd-workflow`, `ecc:database-migrations` (SQLite here, not Postgres), `ecc:react-patterns`, `ecc:frontend-patterns`, `ecc:i18n-sync`, `ecc:verification-loop`. Any `src/ui/` work: also call ReUI `get_agent_skill` first.
- Ignore ECC agents and skills for other stacks (Django, Java, Shopify, network, etc.).
