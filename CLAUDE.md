# aa-finance

Professional personal-finance app with double-entry bookkeeping, modeled on GnuCash. Users know accounting and want detailed tracking. Docs index: [docs/README.md](docs/README.md). Terms: [docs/GLOSSARY.md](docs/GLOSSARY.md). Plan: [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack
- Supabase (PostgreSQL + Auth + RLS + Storage), project ref `ckwigjohcdsfqglmmzdq` (eu-central-1). Dev project only.
- Business logic: TypeScript Supabase Edge Functions. Writes use a direct Postgres connection in one transaction and lock the affected account rows with `SELECT ... FOR UPDATE`.
- Frontend: React + Vite + TypeScript + shadcn/ui + Tailwind, hosted on Cloudflare. **v1 is desktop only** (no mobile or tablet layout).
- Package manager: npm (pnpm.exe is blocked by Application Control). Supabase CLI: `npx supabase`. Windows/PowerShell.

## Product rules
- Ledger core first: Chart of Accounts, General Journal, Account Register, Reports. Judge every feature against this core.
- Follow accounting standards. The UI uses real accounting terms (Yevmiye, Hesap Planı, Borç/Alacak, Mizan, Bilanço). Account codes follow the Turkish Tek Düzen Hesap Planı style.
- Every journal entry: ≥2 lines, total debit = total credit (`base_amount`). A DB trigger enforces it; the Edge Function also validates it.
- Every account has a currency. Lines on an account are in the account currency. A missing rate is fetched by the server; a user-given rate wins.
- A journal entry is a completed event only. Plans and reminders are not entries.
- Convenience flows (quick entry, installment, loan, deposit, FX, investment, plans, wizard, directory) are hidden. Their code stays. Rebuild them later on `journal-post`.
- Out of scope: AI/auto-fill, bank import, notifications, bills/subscriptions.

## Engineering rules
- Money: int64 minor units (`bigint`/string in TS; never float). Rates and quantities: `numeric` → string.
- Never edit an applied migration. Add a new one in `supabase/migrations`.
- Access: everyone in a group reads; only the `journal_entries.member_id` owner edits or deletes (RLS + function).
- Supabase MCP is read-only. Change the schema with a migration + CLI.
- Secrets and the service_role key never go to the frontend or the repo. Read tokens from the root `.env` (template `.env.example`, loading: [DEVELOPMENT](docs/DEVELOPMENT.md#secrets-env)). Never print values.

## Docs and agents
- Language: English for docs and code. UI text: Turkish and English in `web/src/i18n/`. `docs/ux/**` (Turkish) is paused reference.
- Writing rules: `.claude/rules/writing.md`. Agent rules (ownership, handoff, learning loop): `.claude/rules/agents.md`.
