---
owner: main
status: active
---

# Development notes

Quick start and fixes for repeated mistakes. Decisions: [ARCHITECTURE](ARCHITECTURE.md).

## Commands
| Task | Command |
|---|---|
| Frontend dev | `cd web && npm run dev` |
| Build (type check + build) | `cd web && npm run build` |
| Lint (oxlint) | `cd web && npm run lint` |
| Supabase CLI | `npx supabase ...` (pnpm is blocked) |

Minimum check after a change: `npm run lint && npm run build` (now: lint 1 warning, build clean).

## Machine pitfalls (Windows)
- **No pnpm:** Application Control blocks it. Use npm.
- **PowerShell 5.1 breaks UTF-8** (BOM, mojibake). Write files with the Write/Edit tools. Do not touch Turkish content with `Set-Content`/`Get-Content`.
- **A `SUPABASE_ACCESS_TOKEN` set with `setx` is not visible in the Claude session.** Read it with `[Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN','User')`. Do not write the token to a file or the repo.
- **Supabase MCP can return "Unauthorized"** (`.mcp.json` does not see the token). Fix: put the token in the User env var and restart Claude Code. Else use the CLI. MCP is read-only anyway; schema changes always go through migration + CLI.
- The dev DB password is unchanged on purpose (dev stage). Never write it to a file.

## Secrets (.env)
- The root `.env` (gitignored) holds tokens and secret keys. The template `.env.example` is committed and has no values. Frontend vars are separate: `web/.env.local` (only `VITE_*`, not secret).
- `.env` does not load automatically for Claude/CLI. Load it per command. **Never print or log a value.**
  - bash: `set -a; . ./.env; set +a; npx supabase ...`
  - PowerShell: `Get-Content .env | ? { $_ -match '^\s*[^#]\S*=' } | % { $k,$v = $_ -split '=',2; Set-Item "env:$($k.Trim())" $v.Trim() }`
- The direct `SUPABASE_DB_URL` (`db.<ref>.supabase.co`) is IPv6 only and fails on this machine. The CLI does not need it: with `.env` loaded, `npx supabase migration list --linked` and `db push --linked` work with `SUPABASE_ACCESS_TOKEN` only (verified 2026-10-07). For direct SQL, use the shared pooler URL.
- Check presence, not value: `[ -n "$SUPABASE_ACCESS_TOKEN" ] && echo set`.
- `.mcp.json` reads `${SUPABASE_ACCESS_TOKEN}` from the process env, not from `.env`. For MCP, the token must also be in the User env var, and Claude Code must restart.
- Do not show `.env` with Read/cat. To see key names: `sed -E 's/=.*/=<hidden>/' .env`.

## Working rules
1. Never edit an applied migration. Add a new file (`supabase/migrations/YYYYMMDDHHMMSS_name.sql`).
2. After a schema change, run the Supabase advisors (security + performance). They catch missing RLS.
3. Money is `bigint`/string everywhere. Rate/quantity is `numeric` → string. No float.
4. New Edge Function: use the `_shared/` helpers (db, http, accounts, uuid). Write = one transaction + `FOR UPDATE` on the affected account rows.
5. If unsure of library syntax, check current docs with context7. Versions are new (react-router 8, tailwind 4, vite 8, i18next 26) and can differ from training data.
6. Open every UI change with the playwright MCP and take a screenshot. Screenshots go to `.playwright-mcp/` (gitignored).

## Status (2026-10-07)
All phases run on the dev project and passed end-to-end tests: quick expense/income, edit/delete, accounts/categories, transfer, debts, multi-currency (average cost, FX gain/loss), installments, investments, reports, attachments, period lock.

Edge Functions: onboarding-create-group, onboarding-join-group, invite-create, group-update, profile-update, avatar-upload, transaction-create/update/delete, account-create/update/delete, transfer-create, debt-create, fx-exchange, installment-create/pay, investment-trade/revalue, attachment-create/delete.

End-to-end tests: node scripts (temporary, not in the repo) that use `.env` (with service_role) + `@supabase/supabase-js`, create a confirmed test user and call the functions. Dev test users: `e2e-test@aa-finance.test`, `e2e-join@aa-finance.test`. Their password is changed temporarily through the admin API during tests.

## Before release (user tasks)
- Cloudflare Pages: build `cd web && npm run build`, output `web/dist`, vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. `public/_redirects` holds the SPA redirect.
- Edge Function CORS: add the release origin: `npx supabase secrets set ALLOWED_ORIGINS=https://<origin>,http://localhost:5173` (if unset, only local dev is allowed).
- Custom SMTP (built-in email: 2 per hour), leaked-password protection in Auth settings (dashboard; advisor warning), Site URL / redirect URLs.
- Delete test users and test data (or use a new project).

## Known debt and limits
- Edit works only for simple records (2 lines, base currency) of expense/income. Other records (transfer, debt, split, FX, investment, installment) can be deleted from the list but not edited.
- `installment-pay` is no longer used by the UI (the card payment is the real event). The installment schedule is display only (`/ayarlar/taksitler`).
- No unrealized FX revaluation (the line constraint `amount > 0` allows only amount changes). FX gain/loss is realized on spend or sale.
- No cross-currency (USD→EUR) and no transfer between FX accounts. For an investment, the payment account must match the instrument currency or the base currency.
- The transactions page loads 30 records at a time (client-side search/type filter covers loaded records only). Reports compute on the client (minor-unit amounts as JS number, in the safe range).
- If an attachment upload stops halfway (row exists, file does not), an orphan row stays.
- Installments: base currency + credit card only. A paid installment cannot be undone (delete the payment record to reopen it).
- Prices and rates are manual, not fetched.
- Lint warnings: `only-export-components` in shadcn components and `set-state-in-effect` in `use-mobile.ts` (harmless).

## UI (shadcn) and account tree
- shadcn: `web/components.json` (base `base` = base-ui, preset `bKsFTYsS`: luma/cyan/stone/Inter). Change preset: `npx shadcn@latest apply <code>` (in `web/`). Add a component: `npx shadcn@latest add <name>`. Project skill: `web/.agents/skills/shadcn`; MCP `shadcn` in `.mcp.json`.
- Quick entry (`QuickEntry` → `components/entry/*`): Expense · Income · Transfer · Debt · ATM. `transfer-create` treats a missing side as the member's cash account (ATM). After a create, `useAfterSave` (`lib/entry.ts`) shows an Undo toast (= `transaction-delete`).
- Directory (Rehber, `/rehber`): `contacts.kind` individual | brand | business, `default_category_id` (brand), `brand_businesses` (many-to-many), `contact_bank_accounts` (IBAN). Writes: `contact-save`, `contact-archive`. A new name gets its kind from context (`findOrCreateContact`: expense/income → brand, debt/split → individual). A brand learns its first category (`learnBrandCategory`); the expense form fills the category from the brand. The firm is not asked at entry.
- Upcoming (`components/Upcoming.tsx`, Home): card payments from view `card_due_status` (needs statement/due day in `credit_card_settings`, set in the account form; remaining = statement debt − payments since), debt due dates from `plans` (`debt-create` `due_date`), and undated open balances. A row closes when the real record is entered (card payment, settle-up); `plan-update` postpones or dismisses. Row actions open Quick entry with a preset (`EntryPreset`).
- Expense options: installment (`installment-create`; first due date derives from `credit_card_settings`, else +1 month) and split (`split: [{name, amount?|percent?}]` on `transaction-create`/`installment-create`, `_shared/split.ts`): my share = expense, each person = receivable line; blanks and I share the rest equally, the extra cent stays with me.
- Shell: mobile has 6 bottom tabs + an "Add" button; desktop has a left sidebar (`AppShell`). Routes: `/`, `/islemler`, `/hesaplar`, `/rehber`, `/raporlar`, `/ayarlar` (+ `/ayarlar/taksitler|yatirimlar`).
- Account tree: `accounts.parent_id` (any depth). DB trigger `accounts_parent_chk`: same group/type; for a balance-sheet account, same owner + currency; no cycles. View `account_tree_balances` gives balances including the subtree. `account-create` (`parent_id`, `type` for categories), `account-update` (move with `parent_id`), `account-delete` (hard delete if the subtree has no movements/installments/investments, else archive).
