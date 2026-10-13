---
owner: product-lead
status: draft
---

# Repo scan (2026-10-13)

Read-only scan by `ecc:code-explorer`. Tests, `tsc`, lint and coverage were **not** run. Line numbers may drift.

## Layers
- `src/core/`: pure TS. `db.ts:8-16` is the `Db` interface (`query`, `batch`). `api/` holds the named ops (accounts, contacts, entries, fx, logs, members, reports, settings), `ctx.ts`, `errors.ts`, `index.ts` (op registry). Also `quick.ts`, `money.ts`, `pin.ts`, `chart.ts`, `setup.ts`, `countries.ts`, `migrate.ts`, `migrations/0001..0012`.
- `src/ui/`: `pages/`, `components/`, `lib/`, `i18n/` (tr, en). `lib/api.ts` is the only data door. `tauri-db.ts` is the app adapter; `dev-db.ts` is an HTTP adapter for plain-browser dev (`import.meta.env.DEV` only).
- `src-tauri/src/`: `db.rs` (`db_query`, `db_batch`), `backup.rs`, `lib.rs`, `main.rs`. Thin as intended.

## Path: UI to SQLite
1. Component calls `useOp` or `useWrite` (`src/ui/lib/api.ts`).
2. `createApi` (`core/api/index.ts:81`): writes run through a single promise queue (`:86-99`); locked or not-setup members fail unless the op is in the `open` set (`:64`); input validated with zod (`:116`); `ctx.write` runs the statements plus an `activity_log` row in one `db.batch` (`:124`); failed writes log `ok=0` with the error code (`:136`).
3. Rust `db_batch` runs one transaction and rolls back on error; `db_query` rejects integers beyond ±(2^53-1).
4. Trigger `RAISE(ABORT, '<code>')` becomes `ApiError`; `useErrorText` maps it to `errors.<code>` in i18n.

`entries.post` (`entries.ts:94`): resolve accounts and rates (`rate_missing` when none), allow up to 1 minor unit rounding per converted line into `fx_gain_loss`, insert draft, insert lines, set `posted`. The trigger enforces ≥2 lines and balance.

## Database rules
12 migrations, each applied in one batch with the `user_version` bump (`migrate.ts`). A newer DB than the app throws. Trigger codes cover immutability, accounts, entries (`entry_unbalanced`, `entry_too_few_lines`, `period_locked`), lines, members (`last_admin`) and contacts. `audit_log` (triggers) and `activity_log` (API) are append-only.

## Tests
- Runner: `node --test "src/**/*.test.ts"`. Files: `api.test.ts` (26), `schema.test.ts` (17), `quick.test.ts` (5), `db.test.ts` (4), `money.test.ts` (2), `kept.test.ts` (2). Rust unit tests in `db.rs`, `backup.rs`.
- Baseline (verified 2026-10-13): `npm test` 54/54, `tsc` clean, `oxlint` no errors (warnings only in vendored ReUI `data-grid`), `cargo test` 4/4.
- Coverage (`node --test --experimental-test-coverage`, `src/core` + `ui/lib/kept.ts`): lines 98.7%, branches 90.8%, functions 96.5%. `pin.ts`, `migrate.ts`, `chart.ts`, `setup.ts` are covered indirectly (100% lines).
- Gaps: `core/api/fx.ts` (lines 80%, funcs 60%; uncovered 8-13, 42-44), `ui/lib/kept.ts` (77%; 28-35), `accounts.ts:57-61`, `quick.ts:167`; lowest branch coverage in `quick.ts` 80.6%, `pin.ts` 81.8%. `ui/lib/amount.ts` and `format.ts` are not in the report. No E2E, no component tests.

## Findings
| Area | Result |
|---|---|
| Money | No float found; amounts are `z.int()`, rates text. `db.rs:48,59` still accept and return REAL |
| UI to SQL | None. One door: `lib/api.ts` |
| File size | No source file over 800 lines (largest: `0007_audit_columns.sql` 760) |
| Docs vs code | ROADMAP consistent. `period_locked` exists in triggers but no op to lock a period was found |
| `entries.ts:97` | Id is `max(id)+1`; safe only because of the single-writer queue. Breaks with a second window or sync |
| `ctx.ts:84`, `entries.ts:125,150` | `Date.now()` used while `ctx.now()` exists |
| `index.ts:120` | While locked, actor falls back to system user (`id ?? 1`) |
| `api.ts:45` | `t(... as never)` hides missing i18n keys |
| `entries.ts:140-141` | Two stacked JSDoc blocks; the first belongs to `remove` |
| `pin.ts` | App gate, not security (6 digits, PBKDF2 200k) |
| Lint | `oxlint` may not cover rule-file checks such as `console.log` |

## Next steps
1. Run `npm test && npx tsc --noEmit && npm run lint` and `cargo test` for a green baseline.
2. Add coverage (`node --test --experimental-test-coverage`) and fill gaps with `ecc:tdd-guide`.
3. Add a test that every trigger code and every op has i18n strings.
4. Add a Playwright smoke path (`ecc:e2e-runner`).
5. Reconcile `backend/api/operations.md` with `index.ts` and find how `period_locked` is exposed.
6. Use `ctx.now()` in `update()`; fix the double JSDoc.
7. Continue with the ROADMAP "Next" item (Hızlı Kayıt review).

## Inventory (`repo-scan` pre-scan, 2026-10-13)
- Project source: 612 files, 7.49 MB. Of that, `src/` 148 files (1.20 MB), `src-tauri/` 31 (482 KB), `docs/` 32 (71 KB), `scripts/` 3, `archive/` 235 (1.84 MB, deleted afterwards). Stack: 282 TS/JS files, 2 CSS. No bundled third-party code.
- Disk: 12 GB total, 99.9% build output. `src-tauri/target/` alone is 11.83 GB (`debug` 5.75 GB, `release` 1.20 GB); `node_modules/` 239 MB; `dist/` 1.4 MB. Clean with `cargo clean` when space is needed.
- Git: 1 repo, 229 commits, all within the last year.
- Same-name directories (`ui/`, `scripts/`, `inbox/`) are different things (docs vs code, archive vs live), not duplicates.
