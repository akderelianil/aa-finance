---
name: rebuild-status
description: Where the aa-finance rebuild stands (2026-10-17) and what to do first next session
metadata:
  node_type: memory
  type: project
  originSessionId: 041dd174-e7cc-4221-b414-0b1342261923
  modified: 2026-10-17T12:19:53.440Z
---

State on 2026-10-17: core-rebuild-4 is in progress (slice 1 of `ops::Ledger`, typed `DocId`/`RevisionId` in commit ad3e285, ADR-0021 sealed kernel accepted with `npm run kernel:check` in `verify`, base currency fixed per book). Next is the settings document (talk first about what it holds; proposal: only the base currency in v1), then rate on line, account fields and system accounts, input rules, delete, undo, API reference; details in [[core-rebuild-4-decisions]] and `.stories/core-rebuild-4.md`. Counts: 75 unit, 28 operation, 76 store tests, 1 doctest, 15 script tests.

State on 2026-10-14: foundation-reset closed. core-rebuild-1, -2 and -3 are done (store with revisions, projection, verify; exact amounts, rates, rounding line). Reviewer agents (rust-reviewer, silent-failure-hunter, type-design-analyzer, pr-test-analyzer) ran on both; their schema and test findings are fixed (136 tests, mutation experiments on every money and store check, 99.1 percent line coverage). Coverage floor is now 95 percent on money, rules and crypto (ADR-0020, owner feedback). Open store items went into core-rebuild-11 (needs-attention state, idempotent import, provenance); hand-offs for the API went into core-rebuild-4. release-and-quality-5 freezes the deterministic body form before the first release.

Public repository (2026-10-14, owner decisions, all done): the history was rewritten to the GitHub noreply address and pushed; LICENSE (MIT, Anıl Akdereli), README and CONTRIBUTING exist; `legacy/` was deleted from main (the prototype is in the tag `prototype-final`, files at the root there: `git show prototype-final:src/core/money.ts`); the trace test went with it, so docs/RULES-TRACE.md is marked historical until core-rebuild-9 rewrites it. CI stays small even after the repository is public until the product matures (owner decision): code changes only, Ubuntu only, Windows and macOS by hand with `gh workflow run ci.yml` (docs/foundation/ci.md). Backup of the old history: `~/aa-finance-before-email-rewrite-2026-10-14.bundle` (the owner may delete it). The repository is PUBLIC since 2026-10-14 (secret scanning and push protection on, private vulnerability reporting on, fork PRs from any outside contributor need approval, default token read-only; the owner turned on the GitHub e-mail privacy settings). The Windows folder behind the old remote `origin` was an empty directory; it and the remote are removed. Revision bodies stay JSON until release-and-quality-5.

ECC hooks are on (`hooks_enabled: true` in `~/.claude/settings.json`); continuous-learning-v2 collects observations in `~/.local/share/ecc-homunculus/`, its observer is still off. Guide: docs/foundation/ecc-usage.md. Test layout and catalog: [[workflow-notes]].

**Why:** the owner approved the plan and asked to continue story by story, tests first, with reviewer agents.
**How to apply:** run `npm run story -- status`, read the Progress section of `.stories/core-rebuild-4.md`, and continue with the settings document; the store items for sync are core-rebuild-11. See [[foundation-reset-direction]].
