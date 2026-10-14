# Using ECC in aa-finance

Status: in effect since 2026-10-14 (owner said to proceed). Replaces the long agent list in `CLAUDE.md` as the place to look up "which tool, when".

ECC 2.2.3 ships 71 agents, 311 skills, 97 commands and 29 hooks. `.claude/settings.json` allows 38 agents and 154 skills; the rest is denied because it targets other stacks. Most of the allowed set is still unused on any given day. The rule of thumb is: **one tool per step of the work, and the cheapest tool that protects the quality order** (data integrity, then security and privacy, then compatibility, resources, performance).

## 1. The loop for one story

| Step | Use | Why here |
|---|---|---|
| Start of session | `npm run story -- status`, then read the story file | The ledger is the single source of what is next. |
| Unclear or risky requirement | skill `ecc:intent-driven-development` | Turns a vague story into acceptance criteria before code. Skip for stories whose criteria are already written. |
| Design question with a real trade-off | `ecc:architect` or skill `ecc:council`, then `ecc:architecture-decision-records` | Only when a decision would be hard to reverse (schema, API, crypto). Record it as an ADR; supersede, never rewrite. |
| Contract between core and UI | skill `ecc:contract-first`, `ecc:api-design` | Named operations are the public API (ADR-0008). Fix the shape before the code. |
| Write the test | `ecc:tdd-guide` / skill `ecc:tdd-workflow`, `ecc:rust-testing` | Tests first is a project rule. The legacy specs are the acceptance source. |
| Implement | plain editing, skill `ecc:rust-patterns` for Rust | No agent needed for routine code. |
| Build breaks | `ecc:rust-build-resolver` (Rust), `ecc:build-error-resolver` (TS) | Minimal diffs only; never for design changes. |
| Review | see section 2 | Review depth follows risk. |
| Before commit | `npm run verify`, `cargo test --workspace` (the pre-commit hook runs both) | Never skip. `ecc:commit-reviewer` is optional for the message. |
| End of story | `npm run story -- <command>` transition, update `docs/ROADMAP.md` and the memory file | One place for status: the ledger plus `rebuild-status.md`. |

## 2. Review tiers

| Change touches | Reviewers |
|---|---|
| Money, rounding, rates, rules, revisions, crypto | `rust-reviewer` + `silent-failure-hunter` + `type-design-analyzer` + `pr-test-analyzer`; add `security-reviewer` for keys, access control, sync, plugins |
| Other core code | `rust-reviewer` |
| React or TypeScript UI | `react-reviewer` / `typescript-reviewer`; `frontend-a11y` skill on every screen |
| Docs, config, ADRs | hooks only (no reviewer agent) |

`database-reviewer` is Postgres-focused: use it for SQL safety questions only. `code-reviewer` overlaps the language reviewers; use it only where no language reviewer exists.

## 3. Hooks

Hooks are on since 2026-10-14 (`pluginConfigs.ecc@ecc.options.hooks_enabled` in `~/.claude/settings.json`; it had been `false`, which silently disabled all 29). Profile: `standard`.

| Hook | What it does | What to expect |
|---|---|---|
| `gateguard-fact-force` (Bash, Edit, Write) | Asks for the request and the purpose before the first command or edit of a session | One short answer per session. Disable only for repair work: `ECC_GATEGUARD=off`. |
| `config-protection` | Blocks edits that weaken lint, format or type config | A block means the config change needs a reason. |
| `doc-file-warning` | Warns when a stray `.md` is created | New docs belong in `docs/`. |
| `suggest-compact` / `pre:compact` | Suggests compacting at logical points | Follow it between stories, not in the middle of one. |
| `pre:observe` (continuous-learning-v2) | Records tool calls to `~/.local/share/ecc-homunculus/` | Local only, plain text, deleted after 30 days. See section 4. |
| `governance-capture`, `mcp-health-check`, `hookify-runtime`, `skill:track` | Bookkeeping and MCP health | Silent. |
| Stop: `cost-tracker`, `session-end`, `evaluate-session`, `desktop-notify` | Session summary and metrics | Silent. `/ecc:cost-report` reads the metrics. |
| Stop: `format-typecheck`, `check-console-log` | JS and TypeScript checks | Irrelevant while only Rust changes. If noisy, add to `ECC_DISABLED_HOOKS`. |
| Project hook `guard-migrations.ts` | Blocks edits under `legacy/src/core/migrations/` | Part of the "never edit an applied migration" rule. |

To silence one hook without turning all off: `ECC_DISABLED_HOOKS=<id>[,<id>]` in the `env` block of `.claude/settings.json`.

## 4. Continuous learning

Observations accumulate automatically. The analysis that turns them into instincts is off (`observer.enabled: false`). Plan: collect for about a week, then check `/ecc:instinct-status`. Turn the observer on only after reading a sample of `observations.jsonl`: it stores full commands and file paths, and only known secret patterns are redacted, not financial content. Promote an instinct to a skill with `/ecc:evolve` or `/ecc:promote` only when it repeats across stories. Durable facts still belong in `.claude/memory/` and ADRs.

## 5. Use rarely, on a trigger

| Tool | Trigger |
|---|---|
| `/ecc:plan`, `/ecc:plan-canvas` | A change that needs owner approval (new epic, ADR, scope change). Not for single stories. |
| `/ecc:blueprint` | Planning a multi-story epic with dependencies. |
| `ecc:code-explorer` | First touch of an unfamiliar area (for example `legacy/` while porting a spec). |
| `ecc:spec-miner` | Extracting behavior from legacy code when specs are missing. |
| `ecc:e2e-runner` | Browser flows once `apps/desktop/` exists (`desktop-ui` epic). |
| `ecc:refactor-cleaner`, `ecc:code-simplifier`, `/ecc:simplify` | After a story is green, never mixed into it. |
| `ecc:doc-updater`, `/ecc:update-docs` | After an API or architecture change. |
| `ecc:harness-optimizer`, `/ecc:harness-audit` | Once a quarter, or when sessions feel slow. |
| `/ecc:security-scan`, `ecc:security-review` | Before the first release and whenever keys, sync or plugins change. |
| `/ecc:save-session`, `/ecc:resume-session` | Only for work that must continue in another session; the ledger and memory cover the usual case. |
| Multi-model skills (`multi-plan`, `multi-workflow`) | Allowed, but need the external ccg-workflow runtime; not part of the normal loop. |
| Loop skills (`autonomous-loops`, `continuous-agent-loop`, `loop-start`) | Only with explicit stop conditions and a clear mechanical goal, such as fixing a failing test suite. |

## 6. Do not use

- The GitHub-issue `epic-*` commands. Work tracking is `.stories/` only.
- Agents and skills for other stacks (denied in `settings.json`).
- Reviewer agents on trivial or doc-only changes. They cost time and tokens and add noise.
- `orch-*` wrappers for work the ledger already scopes. They add a second process on top of the first.

## 7. Closed gaps and what is left

- Done 2026-10-14: `.claude/rules/rust/` (coding-style, patterns, security, testing from ECC) and `npm run story` (finds the ledger in the newest installed ECC version).
- Left: shorten `CLAUDE.md` (move the long product-rule list to `docs/foundation/vision.md` references) and decide whether to disable `stop:format-typecheck` and `stop:check-console-log` while only Rust changes.
