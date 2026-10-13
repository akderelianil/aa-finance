# aa-finance

Open-source, local-first personal and family finance for people who know no accounting, built on a strict double-entry ledger. Free and private on the user's device; paid, end-to-end encrypted sync comes later. Personal use only; no age limit. Vision: [docs/foundation/vision.md](docs/foundation/vision.md). Docs index: [docs/README.md](docs/README.md). Plan: [docs/ROADMAP.md](docs/ROADMAP.md).

## State of the project
The foundation is being rebuilt from scratch in epic `foundation-reset` (`.stories/`). Interview and decisions: [docs/foundation/](docs/foundation/README.md). The code in `src/` and `src-tauri/` is the retired prototype (Tauri 2 + SQLite + TypeScript + React/ReUI). It is kept only as a source of requirements (its tests and specs) until the rebuild replaces it: do not add features to it; fix only tooling, docs and breakages. The stack of the rebuild is decided in story `foundation-reset-4`; until its ADRs land, make no technology claim beyond this file.

## Product rules
- Purpose: a family ledger a person with no accounting knowledge can run all life finance decisions with, using daily words. Not for business use, tax or e-invoice.
- Ledger core: strict double entry. Every entry has ≥2 lines and balances in the base currency. The database enforces it; the API checks first only for clear messages. Records are append-only revisions: edit and delete in the UI are undo-able revisions, never a hard delete (the user may erase all their data on request). A change log feeds the activity history.
- The default UI speaks daily language and runs scenario templates (data, not code) that build the entries; accounting terms show in an expert mode. A journal entry is a completed event only. Plans, schedules, forecasts and budgets are separate entities, never entries; the user's real record always wins over an estimate.
- Money and commodities: every account has a currency or commodity with its own scale. Values are manual first. A user-given rate or price wins; a price history is kept; reports and balances value holdings at the latest price virtually, with an info tip. The user picks the cost method; a change posts adjustment entries. Exact arithmetic, never float.
- One ledger = one family of 1 to 10 people; a person belongs to one family. Access is role-based per account (see, post, edit, manage). A member sees only their own accounts by default; the admin sees every account and none can be hidden from the admin; counter-lines of hidden accounts are masked in the UI. Real separation exists only across separate devices; on a shared computer the PIN is an app gate and the UI says so.
- Local first and free: no server, no limits on devices or people. Data loss is never acceptable: automatic verified backups, a full restorable backup, CSV export of everything, an open documented schema. A live database inside a cloud-synced folder is refused unless the user overrides. A leaving member may export their data; the family keeps the shared records.
- Sync is paid and comes later, but the data model is sync-ready from day one (global ids, event log). End-to-end encrypted; account identity is separate from the keys; a recovery key is mandatory; family-assisted recovery; losing every device and the key loses the cloud copy. Offline work is normal; the first writer to reach the server wins and the loser is kept as a visible conflict.
- Privacy: no telemetry by default; crash reports only on opt-in, shown before sending, never with financial content. The user is responsible for the security of their own device.
- Plugins: sandboxed and permissioned, never raw database access, every write goes through the same named API and rules. Only plugins approved by the owner at first. The API is public and versioned.
- Dates are civil Gregorian `YYYY-MM-DD` without a time zone; other calendars are display only. Number and date format follow the book country; the UI language picks the words. Turkish and English first.
- First release (v1): free, local, one device. Income/expense, transfer and debt scenarios; Balance Sheet, Income Statement and simple Cash Flow; multi-currency. Next: investments with lots, price history and the gain/loss report. Later: paid sync, attachments, bank import, reconciliation, notifications while the app is closed, budgets and goals, mobile. Ideas: [docs/foundation/backlog.md](docs/foundation/backlog.md).
- Early picks after v1 basics: quick entry (UI plus CLI/API), privacy mode, asset card (value-estimate history), credit-card cycle, net worth and reports in another currency or unit.
- Licenses and contribution: clients and core MIT, sync server AGPL (self-hosting supported), contributions under the DCO.
- Out of scope: AI or auto-fill, tax and e-invoice, business use, a child-specific mode, payment and company set-up (outside the code).

## Engineering rules
- Quality order when goals conflict: 1 data integrity, 2 privacy and security, 3 compatibility (Windows, macOS, Linux; mobile later), 4 low resource use, 5 performance (100k to 1M entries stay fast).
- The database enforces the rules (triggers, stable error codes). The UI and plugins call only named API operations, never SQL.
- Every shared piece of logic lives once, in a core that every platform can use. Claude Code maintains all of it: keep it small, legible and tested.
- Tests first for new logic; the old prototype's specs and tests are the acceptance source for the rebuild. Minimum check after a change: `npm run verify:web` (and `npm run verify:rust` when `src-tauri/` changes) while the prototype exists; a pre-commit hook runs it (`npm run hooks:install`).
- Never edit an applied migration (prototype): add a new file.
- Secrets: none in v1. If a token is needed, keep it in the gitignored root `.env`, load it per command, never print or commit it.
- Work tracking: `.stories/` via `ecc:story-lifecycle` (epic -> stories -> sprint). Write only through its `ledger.js`. Do not also run the GitHub-issue `epic-*` commands for the same work.
- Git: Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`, `ecc:`); `npm run changelog` rebuilds `CHANGELOG.md` from them. Commit by default and push to the private `github` remote after each finished change (the owner does not want to be asked each time).
- Working style with the owner: ask many questions before designing; criticise assumptions; say no with reasons and hold the position when right. The owner asked for this explicitly.

## Docs and ECC
- Language: English for docs and code; `docs/product-designer/ux/**` is Turkish (one scenario per file). UI text: Turkish and English.
- Docs are grouped by role: `docs/product-designer/`, `docs/backend/`, `docs/foundation/` (decisions of the rebuild); shared files in `docs/`. Decisions: [docs/adr/](docs/adr/README.md) (supersede, never rewrite).
- Agent, skill and hook tooling is the ECC plugin (`ecc@ecc`, project scope, hook profile `standard`). Rules in `.claude/rules/` are a lean subset of ECC's.
- Planning and design: `ecc:planner`, `ecc:architect`, `ecc:code-architect`, `ecc:code-explorer`; skills `ecc:blueprint`, `ecc:council`, `ecc:intent-driven-development`, `ecc:architecture-decision-records`, `ecc:contract-first`, `ecc:change-impact`; `ecc:plan-canvas` for owner review; diagrams as Artifacts (`artifact-diagramming`).
- Build: `ecc:tdd-guide` and `ecc:tdd-workflow` for logic; `ecc:database-migrations`, `ecc:api-design`, `ecc:error-handling`, `ecc:i18n-sync`; for the UI also `ecc:frontend-patterns`, `ecc:frontend-a11y`; Rust and Tauri: `ecc:rust-patterns`.
- Review: `ecc:typescript-reviewer`, `ecc:react-reviewer`, `ecc:rust-reviewer` per language touched; always `ecc:silent-failure-hunter` and `ecc:type-design-analyzer` on money and rule code; `ecc:security-reviewer` for keys, access control, sync and plugin code; `ecc:pr-test-analyzer`; `ecc:e2e-runner` for browser flows. `ecc:database-reviewer` is Postgres-focused: use it for SQL safety only. `ecc:build-error-resolver` when the build fails.
- Flow wrappers: `ecc:orch-add-feature`, `orch-fix-defect`, `orch-change-feature`, `orch-refine-code`. Docs and commits: `ecc:doc-updater`, `ecc:docs-governance`, `ecc:commit-reviewer`. Verify: `ecc:verification-loop`.
- ECC agents and skills for other stacks (Django, Java, Shopify, network, etc.) stay denied in `.claude/settings.json`.
