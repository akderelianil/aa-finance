# aa-finance

Family personal-finance app with double-entry bookkeeping. Docs index: [docs/README.md](docs/README.md). Terms: [docs/GLOSSARY.md](docs/GLOSSARY.md).

## Stack
- Supabase (PostgreSQL + Auth + RLS + Storage), project ref `ckwigjohcdsfqglmmzdq` (eu-central-1). Dev project only.
- Business logic: TypeScript Supabase Edge Functions. Writes use a direct Postgres connection in one transaction and lock the affected account rows with `SELECT ... FOR UPDATE` (average-cost race).
- Frontend: React + Vite + TypeScript + shadcn/ui + Tailwind, mobile-first PWA, hosted on Cloudflare.
- Package manager: npm (pnpm.exe is blocked by Application Control). Supabase CLI: `npx supabase`. Windows/PowerShell.

## Rules
- Every record is double-entry: ≥2 lines, total debit = total credit (`base_amount`). A DB trigger enforces it; the Edge Function also validates it.
- Money: int64 minor units (`bigint`/string in TS; never float). Rates and quantities: `numeric` → string.
- Never edit an applied migration. Add a new one in `supabase/migrations`.
- The server derives every derivable value (rate, TRY amount, gain/loss, account creation). It is optional in the request; a user-given value wins.
- Access: everyone in a group reads; only the `journal_entries.member_id` owner edits or deletes (RLS + function).
- Supabase MCP is read-only. Change the schema with a migration + CLI.
- Secrets and the service_role key never go to the frontend or the repo. Read tokens from the root `.env` (template `.env.example`, loading: [DEVELOPMENT](docs/DEVELOPMENT.md#secrets-env)). Never print values.
- UI: for lazy, non-technical users. Minimum fields, no accounting terms.
- A record is a completed event only. Future or estimated events are not records (an installment purchase records the full amount as expense + card debt). Plans and reminders are display only. All entry is manual first; integrations come later.
- Scope: cash advance and loan are in v1 (decided 2026-10-07). Out of scope: AI/auto-fill, bank import/integration, native/phone notifications (in-app list only), bills/subscriptions (later).

## Docs and agents
- Language: user-facing docs (`docs/ux/**`) in Turkish; everything else in English.
- Writing rules: `.claude/rules/writing.md`. Agent rules (ownership, handoff, learning loop): `.claude/rules/agents.md`.
