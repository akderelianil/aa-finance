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

Minimum check after a change: `npm run lint && npm run build` (now: lint 1 warning, build clean). After a UI text or `docs/ux` change, also run `npm run check:terms` ([GLOSSARY](GLOSSARY.md)).

## Machine pitfalls (Windows)
- **No pnpm:** Application Control blocks it. Use npm.
- **PowerShell 5.1 breaks UTF-8** (BOM, mojibake). Write files with the Write/Edit tools. Do not touch Turkish content with `Set-Content`/`Get-Content`.
- The dev DB password is unchanged on purpose (dev stage). Never write it to a file.
- **Supabase MCP is read-only and may return "Unauthorized"** (token not in its process env). Use the CLI; see Secrets.

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
6. Open every UI change with Playwright CLI and take a screenshot: `npx -y @playwright/cli open <url>`, then `screenshot`, then `close`. Snapshots and screenshots go to `.playwright-cli/` (gitignored).

## Status (2026-10-08)
Ledger core built and committed: F0–F6, Q1 Quick Transaction, D1 Rehber, S1 Simple chart, H1 Ana Sayfa, journal tags ([ROADMAP](ROADMAP.md)). Entry flows: Gider, Gelir, Transfer ([ux](ux/README.md)); other convenience flows were deleted.

Core Edge Functions: journal-post, fx-rate, account-create/update/delete, contact-save, contact-archive.

End-to-end tests: temporary node scripts (not in the repo) that use `.env` (with service_role) + `@supabase/supabase-js`, create a confirmed test user and call the functions. Dev test users: `e2e-test@aa-finance.test`, `e2e-join@aa-finance.test`.

## Before release (user tasks)
- Cloudflare Pages: build `cd web && npm run build`, output `web/dist`, vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. `public/_redirects` holds the SPA redirect.
- Edge Function CORS: `npx supabase secrets set ALLOWED_ORIGINS=https://<origin>,http://localhost:5173`. Unset = only local port 5173. The dev project sets 5173 and 5174 (`localhost`, `127.0.0.1`); another Vite port gives "Bağlantı kurulamadı".
- Custom SMTP (built-in email: 2 per hour), leaked-password protection (dashboard), Site URL / redirect URLs.
- Delete test users and test data (or use a new project).

## Known debt and limits
- Journal and reports load the date range on the client; amounts are JS numbers in the safe range.
- Prices and rates are manual, except the `fx-rate` day rate.
- Lint warnings: `only-export-components` in shadcn components and `set-state-in-effect` in `use-mobile.ts` (harmless).

## UI (shadcn) and account tree
- shadcn: `web/components.json` (base `base` = base-ui, preset `bKsFTYsS`: luma/cyan/stone/Inter). Change preset: `npx shadcn@latest apply <code>` (in `web/`). Add a component: `npx shadcn@latest add <name>`. Project skill: `web/.agents/skills/shadcn`; MCP `shadcn` in `.mcp.json`.
- Tags: `tags` (group-shared, unique name per group) + `entry_tags` (entry ↔ tag). `journal-post` takes `tags: string[]` (`parseTags`, max 10 × 40 chars); on update, omitted `tags` keep the current list. The journal shows `#tag`, filters by tag (loads all entries of the tag) and shows the tag's expense/income total.
- Directory (Rehber, `/rehber`, `pages/Directory.tsx`, `lib/contacts.ts`, `components/journal/ContactPicker.tsx`): `contacts.kind` individual | brand | business, `default_income_account_id` and `default_expense_account_id` (any kind), `brand_businesses` (many-to-many), `contact_bank_accounts` (IBAN; person and business). Writes: `contact-save`, `contact-archive` (blocked while `contact_ledger_balances` is not zero). The open balance is the receivable/payable lines tagged with the contact (whole group, base currency; B/A = debit/credit balance). Quick Transaction and the journal editor have a Rehber field: it tags every line with `contact_id`; in Gelir/Gider the contact's default account fills the first account line (replaced only while empty or still the previous default).
- Shell: desktop only, left sidebar (`AppShell`). Routes: `/hesaplar` (Chart of Accounts, start page), `/hesaplar/:id` (Account Register), `/yevmiye`, `/raporlar`, `/ayarlar`.
- Chart of Accounts (`/hesaplar`, `pages/Accounts.tsx`, `components/coa/AccountDialog.tsx`): tree ordered by hidden code (`lib/ledger.ts`: `useLedgerAccounts`, `compareCodes`, `shown` = normal-sign balance). Columns: name, kind, currency, owner, own balance (account currency), subtree total (base, view `account_tree_balances`). Locked system accounts show a lock and have no rename, delete or archive. The New Account dialog asks name, group, currency, owner. Any member creates, edits, archives or deletes a free account (`account-create/update/delete`, `_shared/accounts.ts`). Double-click opens the Account Register.
- General Journal (`/yevmiye`, `pages/Journal.tsx`, `components/journal/JournalEditor.tsx`, `AccountPicker.tsx`, `lib/journal.ts`): entries of a date range (ascending) with lines in base currency; foreign lines show amount × rate. The editor posts to `journal-post`: keyboard account picker (name or group), debit/credit, memo, rate and base amount for foreign lines (day rate from `fx-rate` as placeholder), live totals and imbalance. "Satır ekle" (or Enter in the last amount) proposes the open difference. Ctrl+Enter saves. A tags field (`TagsField`) sits under the date row; lists show `#tag` chips. Only the entry owner sees edit and delete.
- Account Register (`/hesaplar/:id`, `pages/AccountRegister.tsx`, `useAccountEntries`): one row per line on the account with the other account ("— Çok satırlı —" for a split), debit, credit and running balance in the account currency (normal sign). A date range hides rows; "Devreden bakiye" shows the balance before it. New and edit use the same `JournalEditor`, the first line prefilled with the account.
- Reports (`/raporlar`, `pages/Reports.tsx`, `lib/reports.ts`): RPC `account_period_totals(p_from, p_to)` gives base-currency debit/credit before and inside the period per account; `rollUp` sums subtrees. Mizan = cumulative to the end date (debit/credit totals and balances). Bilanço = at the end date; unclosed income − expense shows as "Dönem net kârı / zararı" in equity and the page checks assets = liabilities + equity. Gelir Tablosu = period. Depth filter and zero-row toggle.

## Memory (portable)
Claude memory lives in the repo: `.claude/memory/` (index `MEMORY.md`). On a new machine, clone the repo and add to `.claude/settings.local.json` (gitignored, per machine): `"autoMemoryDirectory": "<absolute path to repo>\.claude\memory"`. Then restart Claude Code. Secrets never go into memory.

## Code graph (graphify)

A knowledge graph of the code lives in `graphify-out/` (git-ignored, rebuildable). Claude Code queries it before grepping, which saves tokens.

- Install once: `python -m pip install --user uv`, then `python -m uv tool install "graphifyy[sql]"`.
- `graphify.exe` is blocked by Application Control. Use `scripts/graphify.cmd <args>` (runs `python -m graphify` from the uv tool env).
- Commands: `scripts/graphify.cmd query "<question>"`, `path "<A>" "<B>"`, `explain "<concept>"`, `update .` (AST only, no API cost).
- Git hooks (`post-commit`, `post-checkout`) rebuild the graph. Re-install them with `scripts/graphify.cmd hook install`. Exclusions: `.graphifyignore`.
- Strict mode is on (`.claude/settings.json`): the first raw file read per session is blocked until one query ran. Disable with `GRAPHIFY_HOOK_STRICT=0`.
