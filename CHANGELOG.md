# Changelog

Generated from Conventional Commits by `npm run changelog`. Do not edit by hand.

## 2026-10-14

### Features
- **core:** refuse a line whose given rate and given base disagree (rate_base_conflict) (9256323)
- **core:** exact amounts, rates and the rounding line (core-rebuild-3) (1cad5ac)

### Fixes
- **core:** close the integrity gaps found by the store review; coverage floor 95 percent (core-rebuild-2, -3) (6f4bbee)

### Refactoring
- **core:** move unit tests out of the production files into <file>/tests.rs (26c0e50)

### Documentation
- add LICENSE (MIT), README and CONTRIBUTING (DCO) (76edda4)
- ECC usage guide (which tool, when) linked from CLAUDE.md and docs index (3e68e52)
- memory, roadmap and state updated for the next session (d34003d)

### Tests
- **core:** split the store tests by topic and generate a test catalog (a23bff1)
- **core:** cover the failure paths of the store and projection; open release-and-quality-5 (core-rebuild-2) (c85c1cd)
- **core:** cover rebuild, drift and error paths; record 1M-entry measurements (core-rebuild-2) (ca2879e)

### CI
- run on code changes only, prototype checks on legacy/ changes, cross-OS matrix by hand (efbcfbf)

### Chores
- add npm run story, Rust rules from ECC, mark the ECC usage guide in effect (b963e17)
- allow ten ECC skills for loops, multi-model workflows and learning (8e91d6c)

## 2026-10-13

### Features
- **core:** schema v1, revision store, projection and verify_projection (core-rebuild-2) (4849b5c)
- **ui:** member grants and member removal in Settings; hide shared-data controls without a grant (harness-plan-9) (e5fe815)
- admin grants for accounts, rates and contacts (ADR-0007, migration 0013) (732c73b)
- generated API reference, i18n completeness tests, five missing error messages (harness-plan-4) (759a205)
- route API timestamps through ctx.now, guard open ops, add migration guard hook script (harness-plan-5) (bf79591)
- add verify gate, pre-commit hook and coverage threshold (harness-plan-1) (a54c080)

### Fixes
- **ui:** no shared-data creation in Quick Entry without a grant, tidy grants UI (review findings) (f881bc6)
- lock out removed members, live-actor permission triggers (0014), reset grants on demotion, grant activity summary (82ed64c)
- user rate wins, members.remove, recursive contacts.balances; correct CLAUDE.md and rule docs (harness-plan-8) (eb98e3e)

### Documentation
- plan approved in the canvas; foundation-reset closed, core-rebuild-2 started (189c98d)
- epics core-rebuild, desktop-ui, release-and-quality and sprints 6-7; CLAUDE.md aligned with ADRs (c82adb8)
- migration plan (be84c75)
- ADR 0008-0019, technical design with diagrams; stories 4 done, 5 in review (cfd6195)
- options 6 notifications and 7 testing and CI (dc45142)
- options 5 scenarios and plugins, interview rounds 16-17 (908a33d)
- options 4 security review and threat model (722a783)
- options 4 keys, identity and access (draft) (307a038)
- options 3 revised after Cloudflare price check (3be8c0b)
- options 2 simplified visibility, options 3 sync and server (0669428)
- options 2 revised after independent reviews (3c0ff58)
- foundation interview round 12 (c58a8e2)
- options 1 decisions, options 2 amounts and data model (ee6f64d)
- revise options 1 after research and owner round 10 (61cd4bc)
- foundation options 1, core language and UI (b40c0db)
- vision approved, age limit removed (8b07e05)
- rewrite CLAUDE.md, vision, roadmap, trace and memory for the foundation reset (0d262c1)
- foundation audit; story 1 done, story 2 in review (03815dd)
- foundation interview round 8, discovery closed (223feff)
- foundation interview round 7 and backlog (449dcfc)
- foundation interview round 6 (212b358)
- foundation interview round 5 (259e3b1)
- foundation interview round 4 (c4cc056)
- foundation interview round 3 (3b84c26)
- foundation interview round 2 (3528fd9)
- foundation interview round 1 (32b6df9)
- harness audit 39/39, epic harness-plan complete (395d701)
- changelog generated from Conventional Commits, final harness re-audit (harness-plan-7) (f1e4280)
- behavior specs, rules trace and findings; tests keep the trace honest (harness-plan-3) (6869a17)
- record harness re-audit (35/39) (d686f02)
- add ADR 0001-0006 and index them (harness-plan-2) (4ce687e)
- track the harness plan in .stories via story-lifecycle (epic + 7 stories) (f9eaaef)
- add harness audit and improvement plan (554654d)
- record verified baseline and coverage in repo scan notes (0742397)
- add repo-scan inventory (6c5af76)
- add repo scan notes (79001f7)
- drop references to retired local agents, skills and graphify (640b580)

### Tests
- browser smoke path, grants UI and kept-draft E2E, formatLocale unit tests (harness-plan-6) (4c5696a)
- cover fx, accounts.usage, quick fee currency, useKept and amount helpers (a80483b)

### CI
- add GitHub Actions, PR/issue templates, CODEOWNERS, dependabot, SECURITY.md, memory notes (292a4d0)

### Chores
- move the prototype to legacy/, add the Rust workspace skeleton and a three-OS CI job (core-rebuild-1) (a1857f2)
- open epic foundation-reset and sprint 5 (1337272)
- harness-plan-3 done (294a363)
- harness-plan-4 done (32d9165)
- harness-plan-1 done (b987cef)
- remove archive/ (retired Supabase version stays in tag supabase-final) (58d3d2f)

### Tooling (ECC)
- owner allows more ECC skills and agents (deny list trimmed) (32172f8)
- enable migration guard PreToolUse hook; harness-plan-5 done (5a053c5)
- allow story-lifecycle, intent-driven-development, project-flow-ops, blueprint, epic-* (c689fd8)
- allow skills and agents useful for this project (938798c)
- deny ECC agents and skills for stacks this project does not use (f4e2e66)
