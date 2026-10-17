---
name: workflow-notes
description: "Tools, commands and gotchas learned while building aa-finance (ledger, plan-canvas, Claude Docs, cargo, hooks)"
metadata:
  node_type: memory
  type: reference
  originSessionId: 5aeb85f2-b754-4425-a5c1-3a02130e9db4
  modified: 2026-10-17T12:34:17.860Z
---

- Work tracking: only through `ledger.js` of the ECC story-lifecycle skill (run it with `npm run story -- <command>`); stories move one step at a time (todo, in-progress, review, done); a sprint file must exist before a story names it.
- Pre-commit hook runs `npm run verify` at the root (repo scripts and the test catalog) and `cargo test --workspace`; it prints a lot, redirect output when scripting.
- Rust: workspace in crates/, `cargo llvm-cov --workspace --summary-only` for coverage (installed), `cargo run --release -p aa-core --example gen_fixture -- file.db 1000000` for the 1M fixture. Tests use the `test-support` feature through a self dev-dependency.
- Plan review in the browser: `node ~/.claude/plugins/cache/ecc/ecc/2.2.3/scripts/plan-canvas.js open|await|end <file>` (no ecc-plan-canvas on PATH); run `await` in the background. The review file lives in .claude/plans/ (gitignored).
- Claude Docs review page: https://claude.ai/artifact/CTjTAriknKR322K7LhArzC (private; edits go through the Claude Docs connector, not file publishes; whole-block replace needs ifHash and ifRev).
- Cloudflare work uses the cf CLI unless a Wrangler config exists (owner global rule). WebSearch and WebFetch are deferred tools: load them with ToolSearch first.
- Subagents that review code run read-only; ask them for prioritized findings, then fix and re-run tests.
- `npm run verify` also runs `kernel:check` (scripts/kernel-table.ts): every rule code in `RuleCode::as_str` must appear in ADR-0021 and every test named there (`file.rs: \`name\``) must exist. Adding a rule code or renaming such a test means updating the ADR table in the same commit.
- The ECC GateGuard hook asks for facts before the first Bash command, and before the first Edit or Write of each file (callers, schema, the user's verbatim words); state them in text, then retry. In a parallel batch only the denied call fails, so a half-applied set of edits is possible: re-check after a denial. Write on an existing file needs a Read first (cat does not count); use Edit instead.
- Search tests by behavior, not only by trigger or code name: a test can pin a behavior without naming the trigger (an old test of the draft-start trigger was found only when it failed).
- GateGuard in practice: the first Edit or Write of every file is denied once whatever text came before, so put all first-touch edits of a task in one batch with the facts stated in the text just before, then resend only the denied calls. Mechanical renames across many files are fine with a small script; the compiler and the tests check them.
- Refactor recipe that worked (typed ids): write the new type and its tests first, then replace the old type module by module and let the compiler list the next wrong site; keep a raw type where the concept does not exist yet (author id). A `compile_fail` doctest proves two types cannot be mixed.
- Mutation experiment for a trigger or check: copy the schema file to the scratchpad, weaken the condition with sed, run the tests of that topic (they must fail), restore the copy, run again. Do it for every new rule in the kernel table.
- Test helper in the ops tests: `TestClock(Default::default())` (no `Default` impl on the struct itself).
- A Bash `cd` persists between calls; return to /home/anil/aa-finance before relative paths.
- Project memory files in `.claude/memory/` are tracked by git and pushed with the repository.
- Test layout: integration tests in `crates/core/tests/store/` (one module per topic, `common.rs` shared); unit tests in `<file>/tests.rs`, declared by `#[cfg(test)] mod tests;` at the end of the production file (reach private items, stay out of the release). After touching tests run `npm run test:catalog`; `npm run verify` fails when `docs/foundation/test-catalog.md` is stale. Rules in `.claude/rules/rust/testing.md`.
- Adding a rule code (aa-finance core): (1) `src/error.rs`: variant, `as_str` arm, and for a trigger code `TRIGGER_CODES` plus its array length; a code raised by a UNIQUE constraint goes into the `by_message` list in `From<rusqlite::Error>`. (2) `src/error/messages.rs`: Turkish and English text. (3) `src/error/tests.rs`: `ALL`, its array length, and the arm in `listed()`. (4) ADR-0021: a trigger or CHECK rule gets a row in the sealed table (test names must exist), a Rust input refusal goes into the "Refusals of input" sentence; `npm run kernel:check` fails otherwise. (5) `npm run test:catalog`, `npm run verify`, `cargo test --workspace`. (6) Prove the test with a mutation (weaken the trigger, see it fail, restore). Gotchas: a new NOT NULL column breaks the raw `INSERT INTO account` in tests/store/accounts.rs; in `undo`, check the lock before `nothing_to_undo`.
