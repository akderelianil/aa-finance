---
name: rebuild-status
description: Where the aa-finance rebuild stands (2026-10-14) and what to do first next session
metadata:
  type: project
---

State on 2026-10-14: foundation-reset closed. core-rebuild-1, -2 and -3 are done (store with revisions, projection, verify; exact amounts, rates, rounding line). Reviewer agents (rust-reviewer, silent-failure-hunter, type-design-analyzer, pr-test-analyzer) ran on both; their schema and test findings are fixed (136 tests, mutation experiments on every money and store check, 99.1 percent line coverage). Coverage floor is now 95 percent on money, rules and crypto (ADR-0020, owner feedback). Open store items went into core-rebuild-11 (needs-attention state, idempotent import, provenance); hand-offs for the API went into core-rebuild-4. release-and-quality-5 freezes the deterministic body form before the first release.

The owner wants to talk about GitHub Actions before starting core-rebuild-4: minutes are being used up (about 460 billed minutes since 13 Oct, macOS counts x10, Windows x2) and they want to make the repository public; check git history and files for anything private first. Revision bodies stay JSON until release-and-quality-5.

ECC hooks are on (`hooks_enabled: true` in `~/.claude/settings.json`); continuous-learning-v2 collects observations in `~/.local/share/ecc-homunculus/`, its observer is still off. Guide: docs/foundation/ecc-usage.md. Test layout and catalog: [[workflow-notes]].

**Why:** the owner approved the plan and asked to continue story by story, tests first, with reviewer agents.
**How to apply:** run `npm run story -- status`; first settle GitHub Actions and the public-repository questions with the owner; then take core-rebuild-4 (accounts, entries, the named-operation API). See [[foundation-reset-direction]].
