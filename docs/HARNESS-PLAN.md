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
