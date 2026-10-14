---
name: rebuild-status
description: Where the aa-finance rebuild stands (2026-10-14) and what to do first next session
metadata:
  node_type: memory
  type: project
  originSessionId: 041dd174-e7cc-4221-b414-0b1342261923
  modified: 2026-10-14T07:56:48.652Z
---

State on 2026-10-14: foundation-reset closed. core-rebuild-1, -2 and -3 are done (store with revisions, projection, verify; exact amounts, rates, rounding line). Reviewer agents (rust-reviewer, silent-failure-hunter, type-design-analyzer, pr-test-analyzer) ran on both; their schema and test findings are fixed (136 tests, mutation experiments on every money and store check, 99.1 percent line coverage). Coverage floor is now 95 percent on money, rules and crypto (ADR-0020, owner feedback). Open store items went into core-rebuild-11 (needs-attention state, idempotent import, provenance); hand-offs for the API went into core-rebuild-4. release-and-quality-5 freezes the deterministic body form before the first release.

Public-repository preparation (2026-10-14, owner decisions): CI now runs on code changes only (Ubuntu), the prototype jobs only when legacy/ changes, Windows and macOS only when started by hand (`gh workflow run ci.yml`); when the repo is public, remove those limits (docs/foundation/ci.md). LICENSE (MIT, Anıl Akdereli), README and CONTRIBUTING (DCO) are added. The history rewrite to the GitHub noreply address (205502824+akderelianil@users.noreply.github.com) is DONE LOCALLY (298 commits, trees identical, every hash changed; prototype commit 9bc514c is now 32d9165). **The force push to GitHub is still pending**: the classifier blocked it, the owner must run `git push --force-with-lease github main ecc-trial local-first` and `git push --force github prototype-final supabase-final` (with `!` in the prompt). Backup of the old history: `~/aa-finance-before-email-rewrite-2026-10-14.bundle`. After the push: delete the local `refs/original/*` and expire the reflog so the old address leaves `.git`, tell the owner to turn on "Keep my email addresses private" and "Block command line pushes that expose my email" in GitHub, and only then make the repository public (the owner has not asked for that yet). `origin` is a Windows-side clone that still holds the old history. Revision bodies stay JSON until release-and-quality-5.

ECC hooks are on (`hooks_enabled: true` in `~/.claude/settings.json`); continuous-learning-v2 collects observations in `~/.local/share/ecc-homunculus/`, its observer is still off. Guide: docs/foundation/ecc-usage.md. Test layout and catalog: [[workflow-notes]].

**Why:** the owner approved the plan and asked to continue story by story, tests first, with reviewer agents.
**How to apply:** run `npm run story -- status`; first settle GitHub Actions and the public-repository questions with the owner; then take core-rebuild-4 (accounts, entries, the named-operation API). See [[foundation-reset-direction]].
