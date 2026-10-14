---
name: workflow-notes
description: Tools, commands and gotchas learned while building aa-finance (ledger, plan-canvas, Claude Docs, cargo, hooks)
metadata:
  type: reference
---

- Work tracking: only through `ledger.js` of the ECC story-lifecycle skill (run it with `npm run story -- <command>`); stories move one step at a time (todo, in-progress, review, done); a sprint file must exist before a story names it.
- Pre-commit hook runs `npm run verify` at the root (repo scripts + legacy web checks) and `cargo test --workspace`; it prints a lot, redirect output when scripting.
- Rust: workspace in crates/, `cargo llvm-cov --workspace --summary-only` for coverage (installed), `cargo run --release -p aa-core --example gen_fixture -- file.db 1000000` for the 1M fixture. Tests use the `test-support` feature through a self dev-dependency.
- Plan review in the browser: `node ~/.claude/plugins/cache/ecc/ecc/2.2.3/scripts/plan-canvas.js open|await|end <file>` (no ecc-plan-canvas on PATH); run `await` in the background. The review file lives in .claude/plans/ (gitignored).
- Claude Docs review page: https://claude.ai/artifact/CTjTAriknKR322K7LhArzC (private; edits go through the Claude Docs connector, not file publishes; whole-block replace needs ifHash and ifRev).
- Cloudflare work uses the cf CLI unless a Wrangler config exists (owner global rule). WebSearch and WebFetch are deferred tools: load them with ToolSearch first.
- Subagents that review code run read-only; ask them for prioritized findings, then fix and re-run tests.
- Test layout: integration tests in `crates/core/tests/store/` (one module per topic, `common.rs` shared); unit tests in `#[cfg(test)]` modules next to the code (idiomatic Rust, reach private items). After touching tests run `npm run test:catalog`; `npm run verify` fails when `docs/foundation/test-catalog.md` is stale. Rules in `.claude/rules/rust/testing.md`.
