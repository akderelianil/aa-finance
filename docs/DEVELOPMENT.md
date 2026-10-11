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
| Supabase CLI | `npx supabase ...` |

Minimum check after a change: `npm run lint && npm run build` (lint must show no errors; warnings come mostly from ReUI registry code). After a UI text or `docs/ux` change, also run `npm run check:terms` ([GLOSSARY](GLOSSARY.md)).

## Machine notes (Ubuntu on WSL2)
- Work in `~/aa-finance` (ext4). Do not run from `/mnt/c`: it is slow and has file-mode and line-ending noise.
- Use npm. Files are UTF-8 with LF (`.gitattributes`).
- The dev DB password is unchanged on purpose (dev stage). Never write it to a file.
- **Supabase MCP is read-only and may return "Unauthorized"** (token not in its process env). Use the CLI; see Secrets.

## Secrets (.env)
- The root `.env` (gitignored) holds tokens and secret keys. The template `.env.example` is committed and has no values. Frontend vars are separate: `web/.env.local` (only `VITE_*`, not secret).
- `.env` does not load automatically for Claude/CLI. Load it per command. **Never print or log a value.**
  - bash: `set -a; . ./.env; set +a; npx supabase ...`
- The direct `SUPABASE_DB_URL` (`db.<ref>.supabase.co`) is IPv6 only and fails on this machine. The CLI does not need it: with `.env` loaded, `npx supabase migration list --linked` and `db push --linked` work with `SUPABASE_ACCESS_TOKEN` only (verified 2026-10-07). For direct SQL, use the shared pooler URL.
- Check presence, not value: `[ -n "$SUPABASE_ACCESS_TOKEN" ] && echo set`.
- `.mcp.json` reads `${SUPABASE_ACCESS_TOKEN}` from the process env, not from `.env`. For MCP, export it in `~/.bashrc` (see `scripts/wsl/2-linux-bootstrap.sh`), then restart Claude Code.
- Do not show `.env` with Read/cat. To see key names: `sed -E 's/=.*/=<hidden>/' .env`.

## Working rules
1. Never edit an applied migration. Add a new file (`supabase/migrations/YYYYMMDDHHMMSS_name.sql`).
2. After a schema change, run the Supabase advisors (security + performance). They catch missing RLS.
3. Money is `bigint`/string everywhere. Rate/quantity is `numeric` → string. No float.
4. New Edge Function: use the `_shared/` helpers (db, http, accounts, uuid). Write = one transaction + `FOR UPDATE` on the affected account rows.
5. If unsure of library syntax, check current docs with context7. Versions are new (react-router 8, tailwind 4, vite 8, i18next 26) and can differ from training data.
6. Open every UI change with Playwright CLI and take a screenshot: `npx -y @playwright/cli open <url>`, then `screenshot`, then `close`. Snapshots and screenshots go to `.playwright-cli/` (gitignored).

## Tests and test data
Status and phases: [ROADMAP](ROADMAP.md). Entry flows: [ux](ux/README.md).

Unit tests: `npx -y deno test --allow-env supabase/functions/_shared/money_test.ts` (money, rate, date, period lock) and `npm test` in `web/` (exact rate math in `src/lib/quick.ts`).

End-to-end tests: temporary node scripts (not in the repo) that use `.env` (with service_role) + `@supabase/supabase-js`, create a confirmed test user and call the functions. Dev test users: `e2e-test@aa-finance.test`, `e2e-join@aa-finance.test`.

Permanent demo account: `demo@aa-finance.test`, group "Demo Ailesi", recommended chart, 129 entries from 2026-07-12 to 2026-10-11 (salary, rent, bills, market, card, ATM, Borç). The password is `DEV_TEST_PASSWORD` in `.env`. Create or complete it with `node scripts/dev/seed-test-account.mjs`; the script is resumable and posts only the missing entries. Keep this account when you delete test users.

Family members of the demo group: `demo.elif@aa-finance.test` (salary, own bank and card, 51 entries) and `demo.can@aa-finance.test` (allowance, cash, 75 entries). They share the admin password. Create or complete them with `node scripts/dev/seed-demo-members.mjs`.

## Before release (user tasks)
- Cloudflare Pages: build `cd web && npm run build`, output `web/dist`, vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. `public/_redirects` holds the SPA redirect.
- Edge Function CORS: `npx supabase secrets set ALLOWED_ORIGINS=https://<origin>,http://localhost:5173`. Unset = only local port 5173. The dev project sets 5173 and 5174 (`localhost`, `127.0.0.1`); another Vite port gives "Bağlantı kurulamadı".
- Custom SMTP (built-in email: 2 per hour), leaked-password protection (dashboard), Site URL / redirect URLs.
- Delete test users and test data (or use a new project).

## Known debt and limits
- Journal and reports load the date range on the client; amounts are JS numbers in the safe range.
- Prices and rates are manual, except the `fx-rate` day rate.
- Lint warnings: `only-export-components` in shadcn components and `set-state-in-effect` in `use-mobile.ts` (harmless).

## UI and pages
- shadcn: `web/components.json` (base `base` = base-ui, preset `nova`, accent overridden in `web/src/index.css`: calm blue, Geist). Change preset: `npx shadcn@latest apply <name>` (in `web/`), then check `git diff` (the preset resets Badge variants and chart colours). Add a component: `npx shadcn@latest add <name>`. MCP `shadcn` in `.mcp.json` runs with `--cwd web`. UI rules: [aa-finance-ui skill](../.claude/skills/aa-finance-ui/SKILL.md); shadcn skill: `web/.claude/skills/shadcn`.
- Tags: `tags` (group-shared, unique name per group) + `entry_tags` (entry ↔ tag). `journal-post` takes `tags: string[]` (`parseTags`, max 10 × 40 chars); on update, omitted `tags` keep the current list. The journal shows `#tag`, filters by tag (loads all entries of the tag) and shows the tag's expense/income total.
- Directory (Rehber, `/rehber`, `pages/Directory.tsx`, `lib/contacts.ts`, `components/journal/ContactPicker.tsx`): `contacts.kind` individual | brand | business, `default_income_account_id` and `default_expense_account_id` (any kind), `brand_businesses` (many-to-many), `contact_bank_accounts` (IBAN; person and business). Writes: `contact-save`, `contact-archive` (blocked while `contact_ledger_balances` is not zero). The open balance is the receivable/payable lines tagged with the contact (whole group, base currency; B/A = debit/credit balance). Quick Transaction and the journal editor have a Rehber field: it tags every line with `contact_id`; in Gelir/Gider the contact's default account fills the first account line (replaced only while empty or still the previous default).
- Shell: desktop only, left sidebar (`AppShell`): "Hızlı Kayıt" button, menu, display-only month calendar (`SidebarCalendar`). Routes: `/anasayfa` (Ana Sayfa, start page), `/hesaplar`, `/hesaplar/:id` (Account Register), `/yevmiye`, `/raporlar`, `/rehber`, `/ayarlar`.
- Quick Entry (`components/quick/QuickTransactionDialog.tsx`, line builders in `lib/quick.ts`): tabs Gider, Gelir, Transfer, Borç ([ux](ux/README.md)); posts a plain entry to `journal-post`. Defensive form: `AmountInput`, rules in `lib/entryRules.ts` and `check.*` i18n keys; hard errors block Save, warnings do not; Save is never silently disabled.
- ReUI (`@reui` registry in `web/components.json`, skill `.claude/skills/reui`): install with `npx shadcn@latest add @reui/<name>` (in `web/`; large installs can take minutes, run them in the background). Components live in `web/src/components/reui/` (`data-grid`, `frame`, `badge`, `cascader`). MCP `reui` in `.mcp.json` has no token: run `/mcp`, pick `reui`, `Authenticate` (browser sign-in). Registry code needs `src/process-env.d.ts` and a few `noUnused` fixes in `data-grid-table.tsx`; re-check both after a ReUI update. Remove unused registry files (dnd, virtual, cell-selection) after install.
- Chart of Accounts (`/hesaplar`, `pages/Accounts.tsx`, `components/coa/*`): `RootStrip` (two rows: Varlık, Borç, Net varlık / Gelir, Gider, Net gelir; the four root cards filter the tree), a ReUI `data-grid` tree (columns name, kind, own balance, subtree total in base; tree rows from `lib/ledger.ts` `useLedgerAccounts`, ordered by the hidden code, `shown` = normal-sign balance) and `AccountDetail` (side panel: figures, facts, sub-account shares as Progress, actions). A click selects a row and opens or closes its sub-accounts; right-click opens the action menu; actions come from one rule set (`accountActions.ts`). `mergePersonAccounts` folds leaf accounts with the same parent, name, kind and currency but different owners (no owner = "Bilinmeyen") into one display row with owner avatars and a balance tooltip (`OwnerAvatars`); the folded row is closed by default and is display only. Locked system accounts show a lock and have no rename, delete or archive. The New Account dialog (`AccountDialog`, ReUI `cascader` for the group, avatar toggle for the owner, live preview) asks group, name, currency, owner. Any member creates, edits, archives or deletes a free account (`account-create/update/delete`, `_shared/accounts.ts`). Double-click on a name opens the Account Register.
- General Journal (`/yevmiye`, `pages/Journal.tsx`, `lib/journal.ts`): ReUI `data-grid`, one row per entry, newest first (columns User, Date, Account, Amount). A row click shows its lines (`meta.expandedContent`, one Amount column with a Borç/Alacak badge). Period presets: Bu ay, Geçen ay, Bu yıl, Özel. "Yeni kayıt" opens `NewEntryChooser` (Gider, Gelir, Transfer, Borç → Quick Entry; "Serbest kayıt" → `JournalEditor` in a dialog). Edit and delete sit in the row menu, shown by `canModify` (`lib/access.ts`).
- Journal editor (`components/journal/JournalEditor.tsx`, `AccountPicker.tsx`, `TagsField.tsx`): keyboard account picker, debit/credit, memo, rate and base amount for foreign lines (`fx-rate` day rate as placeholder), live totals and imbalance. "Satır ekle" (or Enter in the last amount) proposes the open difference. Ctrl+Enter saves.
- Account Register (`/hesaplar/:id`, `pages/AccountRegister.tsx`, `useAccountEntries`): one row per line on the account with the other account ("— Çok satırlı —" for a split), debit, credit and running balance in the account currency (normal sign). A date range hides rows; "Devreden bakiye" shows the balance before it. New and edit use the same `JournalEditor`, the first line prefilled with the account.
- Reports (`/raporlar`, `pages/Reports.tsx`, `lib/reports.ts`): RPC `account_period_totals(p_from, p_to)` gives base-currency debit/credit before and inside the period per account; `rollUp` sums subtrees. Mizan = cumulative to the end date (debit/credit totals and balances). Bilanço = at the end date; unclosed income − expense shows as "Dönem net kârı / zararı" in equity and the page checks assets = liabilities + equity. Gelir Tablosu = period. Depth filter and zero-row toggle.

## Memory (portable)
Claude memory lives in the repo: `.claude/memory/` (index `MEMORY.md`). On a new machine, clone the repo and add to `.claude/settings.local.json` (gitignored, per machine): `"autoMemoryDirectory": "<absolute path to repo>\.claude\memory"`. Then restart Claude Code. Secrets never go into memory.

## Code graph (graphify)

A knowledge graph of the code lives in `graphify-out/` (git-ignored, rebuildable). Claude Code queries it before grepping, which saves tokens.

- Installed with `pipx install "graphifyy[sql]"` (`~/.local/bin/graphify`). Call `graphify <args>` directly.
- Commands: `graphify query "<question>"`, `path "<A>" "<B>"`, `explain "<concept>"`, `update .` (AST only, no API cost).
- Git hooks (`post-commit`, `post-checkout`) rebuild the graph. Re-install them with `graphify hook install`. Exclusions: `.graphifyignore`.
- Strict mode is on (`.claude/settings.json`): the first raw file read per session is blocked until one query ran. Disable with `GRAPHIFY_HOOK_STRICT=0`.
