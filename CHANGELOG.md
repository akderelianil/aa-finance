# Changelog

Generated from Conventional Commits by `npm run changelog`. Do not edit by hand.

## 2026-10-13

### Features
- **ui:** member grants and member removal in Settings; hide shared-data controls without a grant (harness-plan-9) (fb5f47b)
- admin grants for accounts, rates and contacts (ADR-0007, migration 0013) (1690680)
- generated API reference, i18n completeness tests, five missing error messages (harness-plan-4) (06f711e)
- route API timestamps through ctx.now, guard open ops, add migration guard hook script (harness-plan-5) (cbdaff1)
- add verify gate, pre-commit hook and coverage threshold (harness-plan-1) (a464f17)

### Fixes
- **ui:** no shared-data creation in Quick Entry without a grant, tidy grants UI (review findings) (674fcbb)
- lock out removed members, live-actor permission triggers (0014), reset grants on demotion, grant activity summary (827bd5f)
- user rate wins, members.remove, recursive contacts.balances; correct CLAUDE.md and rule docs (harness-plan-8) (846d9fe)

### Documentation
- changelog generated from Conventional Commits, final harness re-audit (harness-plan-7) (1f5118e)
- behavior specs, rules trace and findings; tests keep the trace honest (harness-plan-3) (79a2e44)
- record harness re-audit (35/39) (c947149)
- add ADR 0001-0006 and index them (harness-plan-2) (21bca97)
- track the harness plan in .stories via story-lifecycle (epic + 7 stories) (1173777)
- add harness audit and improvement plan (8b0259f)
- record verified baseline and coverage in repo scan notes (304c750)
- add repo-scan inventory (278d6b3)
- add repo scan notes (c4d9a76)
- drop references to retired local agents, skills and graphify (a15d6ab)

### Tests
- browser smoke path, grants UI and kept-draft E2E, formatLocale unit tests (harness-plan-6) (2d36036)
- cover fx, accounts.usage, quick fee currency, useKept and amount helpers (deecbc6)

### CI
- add GitHub Actions, PR/issue templates, CODEOWNERS, dependabot, SECURITY.md, memory notes (fc9be9f)

### Chores
- harness-plan-3 done (0543161)
- harness-plan-4 done (9bc514c)
- harness-plan-1 done (f1b2ad4)
- remove archive/ (retired Supabase version stays in tag supabase-final) (5d8a207)

### Tooling (ECC)
- enable migration guard PreToolUse hook; harness-plan-5 done (b6f2f8b)
- allow story-lifecycle, intent-driven-development, project-flow-ops, blueprint, epic-* (2d22b8d)
- allow skills and agents useful for this project (d155d48)
- deny ECC agents and skills for stacks this project does not use (2766fd5)
