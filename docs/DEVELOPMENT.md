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

## Status (2026-10-08)
Ledger-core roadmap in progress ([ROADMAP](ROADMAP.md)). The UX roadmap flows are hidden.
All phases run on the dev project and passed end-to-end tests: quick expense/income, edit/delete, accounts/categories, transfer, debts, multi-currency (average cost, FX gain/loss), installments, investments, reports, attachments, period lock.

Edge Functions (core): journal-post, fx-rate, account-create/update/delete, contact-save, contact-archive. Hidden flows: onboarding-create-group, onboarding-join-group, invite-create, group-update, profile-update, avatar-upload, transaction-create/update/delete, account-create/update/delete, transfer-create, debt-create, fx-exchange, installment-create/pay, investment-trade/revalue, attachment-create/delete.

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
- Quick entry (`QuickEntry` → `components/entry/*`): four kinds, Expense · Income · Transfer · Debt. Layout: large amount on top, then the main fields, then a chip row (account · date · "More"). "More" holds the rare options (installment, split, items, currency, note, tag, debt due date). The Save bar is sticky; `ResponsiveDialog` scrolls its body. Transfer has shortcut chips (ATM withdrawal, ATM deposit, card payment) that fill From/To; FX and investments are links under Transfer. `transfer-create` treats a missing side as the member's cash account. After a create, `useAfterSave` (`lib/entry.ts`) shows an Undo toast (= `transaction-delete`).
- Tags: `tags` (group-shared, unique name per group) + `entry_tags` (entry ↔ tag). Create functions (`transaction-create`, `installment-create`, `transfer-create`, `debt-create`, `loan-create`, `deposit-open`) take `tags: string[]` (`parseTags`, max 10 × 40 chars); `transaction-update` replaces the list when `tags` is given. The journal shows `#tag`, filters by tag (loads all entries of the tag) and shows the tag's expense/income total.
- Directory (Rehber, `/rehber`, `pages/Directory.tsx`, `lib/contacts.ts`, `components/journal/ContactPicker.tsx`): `contacts.kind` individual | brand | business, `default_income_account_id` and `default_expense_account_id` (any kind), `brand_businesses` (many-to-many), `contact_bank_accounts` (IBAN; person and business). Writes: `contact-save`, `contact-archive` (blocked while `contact_ledger_balances` is not zero). The open balance is the receivable/payable lines tagged with the contact (whole group, base currency; B/A = debit/credit balance). Quick Transaction and the journal editor have a Rehber field: it tags every line with `contact_id`; in Gelir/Gider the contact's default account fills the first account line (replaced only while empty or still the previous default). `default_category_id`, `findOrCreateContact` and `learnBrandCategory` are used by hidden flows only.
- Upcoming (`components/Upcoming.tsx`, Home): card payments from view `card_due_status` (needs statement/due day in `credit_card_settings`, set in the account form; remaining = statement debt − payments since), debt due dates from `plans` (`debt-create` `due_date`), and undated open balances. A row closes when the real record is entered (card payment, settle-up); `plan-update` postpones or dismisses. Row actions open Quick entry with a preset (`EntryPreset`).
- Cash advance: Transfer from a credit card to a cash account = `transfer-create`, `source_type='cash_advance'`; optional `fee` → expense category "Nakit avans masrafı", added to the card debt. Interest is entered as an expense when it shows on the statement.
- Loan: Debt → Borrowed → "Bank loan" = `loan-create` (opens a `loan` account + `loan_settings`; lines: deposit, fee = agreed − deposit, cost = total − agreed, credit loan = total). Installments are transfers to the loan account; view `loan_due_status` derives the next installment for Upcoming. Deleting the loan record archives the account (blocked if payments exist).
- Term deposit: Transfer → "+ New term deposit" = `deposit-open` (account subtype `deposit` + `deposit_settings`: principal, annual rate, days, withholding). Upcoming shows maturity and the expected net return (`expectedReturn`, display only). `deposit-settle`: `return` (real amount; difference = income "Vadeli getiri" or expense "Vadeli bozma kesintisi"; account closes) or `renew` (net return, optional withdrawal, new rate/days). Deleting a settle record restores the previous period (`prev`).
- Expense options: installment (`installment-create`; first due date derives from `credit_card_settings`, else +1 month) and split (`split: [{name, amount?|percent?}]` on `transaction-create`/`installment-create`, `_shared/split.ts`): my share = expense, each person = receivable line; blanks and I share the rest equally, the extra cent stays with me.
- Shell: desktop only, left sidebar (`AppShell`). Routes: `/hesaplar` (Chart of Accounts, start page), `/hesaplar/:id` (Account Register), `/yevmiye`, `/raporlar`, `/ayarlar`. Hidden-flow pages stay in `src/pages` without a route.
- Chart of Accounts (`/hesaplar`, `pages/Accounts.tsx`, `components/coa/AccountDialog.tsx`): code-ordered tree (`lib/ledger.ts`: `useLedgerAccounts`, `compareCodes`, `shown` = normal-sign balance). Columns: code, name, kind, currency, owner, own balance (account currency), subtree total (base, view `account_tree_balances`). Any member creates, edits, archives or deletes (`account-create/update/delete`, `_shared/accounts.ts` `parseAccountFields`). Double-click opens the Account Register.
- General Journal (`/yevmiye`, `pages/Journal.tsx`, `components/journal/JournalEditor.tsx`, `AccountPicker.tsx`, `lib/journal.ts`): entries of a date range (ascending) with lines in base currency; foreign lines show amount × rate. The editor posts to `journal-post`: keyboard account picker (code prefix or name), debit/credit, memo, rate and base amount for foreign lines (day rate from `fx-rate` as placeholder), live totals and imbalance. "Satır ekle" (or Enter in the last amount) proposes the open difference. Ctrl+Enter saves. Only the entry owner sees edit and delete.
- Account Register (`/hesaplar/:id`, `pages/AccountRegister.tsx`, `useAccountEntries`): one row per line on the account with the other account ("— Çok satırlı —" for a split), debit, credit and running balance in the account currency (normal sign). A date range hides rows; "Devreden bakiye" shows the balance before it. New and edit use the same `JournalEditor`, the first line prefilled with the account.
- Reports (`/raporlar`, `pages/Reports.tsx`, `lib/reports.ts`): RPC `account_period_totals(p_from, p_to)` gives base-currency debit/credit before and inside the period per account; `rollUp` sums subtrees. Mizan = cumulative to the end date (debit/credit totals and balances). Bilanço = at the end date; unclosed income − expense shows as "Dönem net kârı / zararı" in equity and the page checks assets = liabilities + equity. Gelir Tablosu = period. Depth filter and zero-row toggle.
