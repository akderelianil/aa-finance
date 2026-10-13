---
owner: product-lead
status: draft
---

# Harness audit and improvement plan (2026-10-13)

Source: `ecc:harness-audit` (rubric 2026-05-19), run with `node scripts/harness-audit.js repo --root .`. Score **18/39**. Baseline: `npm test` 71/71, `tsc` clean, lint clean, `cargo test` 4/4, line coverage 100%.

## Score
| Category | Score | Note |
|---|---|---|
| Tool Coverage | 10/10 | |
| Context Efficiency | 10/10 | |
| Quality Gates | 6/10 | no CI workflow |
| Memory Persistence | 0/10 | no durable notes at the checked path |
| Eval Coverage | 0/10 | no `evals/` dir |
| Security Guardrails | 3/10 | no SECURITY.md, no hook guardrails |
| GitHub Integration | 0/10 | not applicable: remote is a local path |

GitHub Integration (CI workflow, PR/issue templates, CODEOWNERS, dependabot) does not fit a local-only repo. Do not chase those points. Replace CI with a local gate (step 1).

## Plan
Each step ends with `npm run verify` green and a commit.

1. **Local quality gate (replaces CI).**
   - Add `npm run verify`: `npm test` + `npx tsc --noEmit` + `npm run lint` + `cargo test --manifest-path src-tauri/Cargo.toml` + coverage threshold (`--test-coverage-lines=90`).
   - Add a git `pre-commit` hook (tracked under `scripts/hooks/`, installed by a one-line script) that runs `verify`. Skills: `ecc:verification-loop`, `/quality-gate`.
2. **Durable memory and decisions.**
   - Create `docs/adr/` with ADRs for: single-writer queue and `max(id)+1`, PIN as app gate, balance via `base_amount` trigger, soft delete only, manual FX rates. Skill: `ecc:architecture-decision-records`.
   - Add `.claude/memory.md` as a short pointer to `docs/adr/` and `CLAUDE.md`.
3. **Specs and traceability.**
   - Mine behavior specs from `src/core/` with `ecc:spec-miner` into `docs/backend/specs/`.
   - Add `docs/RULES-TRACE.md`: Product rule → trigger code → test name. Skills: `ecc:contract-first`, `ecc:context-and-decisions`.
4. **Generated references.**
   - Generate the op list (`backend/api/operations.md`) and the trigger error-code catalog from code; add a test that fails when they drift or when an `errors.<code>` or `ops.<op>` i18n string is missing (removes the `as never` blind spot, `api.ts:45`).
   - Skills: `ecc:doc-updater`, `ecc:docs-governance`, `ecc:living-docs-governance`.
5. **Security guardrails.**
   - Add `SECURITY.md` (threat model: PIN is an app gate, local file, no network) and enable ECC tool/prompt guard hooks in `.claude/settings.json`. Agent: `ecc:security-reviewer`.
   - Make `entries.update` use `ctx.now()`; guard the locked-actor fallback (`index.ts:120`) with a test.
6. **Evals and E2E.**
   - Move the `useKept`/`format.ts` gaps into component tests; extract `formatLocale` to a pure module.
   - Playwright smoke path: setup → PIN → Quick Entry → journal → trial balance. Agent: `ecc:e2e-runner`.
7. **Work tracking.**
   - `docs/work/NNNN-name.md` per feature (goal, acceptance criteria, status, linked ADR and tests). Skills: `ecc:story-lifecycle`, `ecc:intent-driven-development`, `/prp-prd` → `/prp-plan` → `/prp-implement` (after evaluating the first two).
   - Conventional Commits with `ecc:commit-reviewer`; generate a CHANGELOG from them.

## Order and effort
1 (half a day) → 2 → 4 → 3 → 5 → 6 → 7. Re-run the audit after step 2 and step 5; the target is the non-GitHub categories at 8/10 or better.

## Re-audit after sprint 1 (2026-10-13)
Score **35/39** (was 18/39). Stories `harness-plan-1` and `harness-plan-2` are done, plus the GitHub tooling.

| Category | Before | After |
|---|---|---|
| Tool Coverage | 10 | 10 |
| Context Efficiency | 10 | 10 |
| Quality Gates | 6 | 10 |
| Memory Persistence | 0 | 10 |
| Eval Coverage | 0 | 0 |
| Security Guardrails | 3 | 7 |
| GitHub Integration | 0 | 10 |

Two checks still fail:
- **Eval Coverage** (`evals/` or three `tests/**/*.test.js`). A rubric limit: the project has 71 tests in `src/**/*.test.ts` that the audit does not look at. Real gap is E2E (story 6). Passing the check needs an `evals/` folder with fixtures; add it only if it carries real flows (the Playwright smoke path can live there), not as an empty folder.
- **Hook guardrails** (a `PreToolUse` hook in `.claude/settings.json`). Real work in story 5. Candidate guard that matches a project rule: block edits to applied migrations (`src/core/migrations/*.sql`).

## Re-audit after sprint 3 (2026-10-13)
Score **37/39**, the same as after story 5. Stories 1 to 5, 7, 8 and 9 are done; only story 6 (component and E2E tests) is open.

The last failing check is Eval Coverage (0/2). It looks for `evals/` files or `tests/**/*.test.js`, and this project's 100 tests live in `src/**/*.test.ts` and `scripts/**/*.test.ts`. A real E2E path (story 6) can live under `evals/` and close it; no empty folder will be added to buy the point.

What changed since the first audit: local gate (`npm run verify`, pre-commit hook, coverage floor), CI, ADR 0001 to 0007, behavior specs and rules trace with tests that keep them honest, generated API reference and CHANGELOG, migration guard hook, grants for shared data, and a security review of the grants.

## Final audit (2026-10-13)
Story 6 closed the last check: the Playwright specs live under `evals/e2e/` (setup, PIN, Quick Entry, journal, trial balance; the grants UI; an open draft that survives a switch of member), so the audit sees real flows and not an empty folder. The tests run in CI (job "Browser smoke path"). A mutation check (removing the write-back in `useKept`) turned the draft test red, so it covers that code.

All stories of the epic `harness-plan` are done. Open items outside the epic are in `docs/backend/specs/FINDINGS.md` (raw SQL boundary, first-PIN claim, trigger-level admin checks, year/number behavior).
