# ADR-0020: Coverage floor of 95 percent on money, rules and crypto

**Date**: 2026-10-14
**Status**: accepted
**Deciders**: product owner (feedback while closing core-rebuild-2 and core-rebuild-3)

**Relation**: Supersedes the coverage floor in [ADR-0018](0018-quality-gates-and-release-security.md) and in the interview round that fixed it ("80 percent overall, 100 percent on money, rules and crypto"). The rest of ADR-0018 stands.

## Context
Reaching 100 percent line coverage on the store and the money code took tests for branches that only run when the database itself fails or when a guard can never be reached. Two reviewers showed that line coverage was also a weak signal: with 99 percent of lines covered, deleting a whole verification check left every test green. Mutation testing (already part of ADR-0018) measures whether a check is protected; a line count only says that the line ran.

## Decision
The floor is 80 percent line coverage overall and **95 percent** on money, rules and crypto code. Lines that cannot be reached by any test (for example a failure of SQLite itself) are listed with a reason in [measurements](../foundation/measurements.md) and may stay uncovered while the module is above the floor. Guards that cannot happen are removed instead of tested. The quality bar on money and rules code is set by mutation testing and by the reviewer agents, not by the line count alone.

## Alternatives Considered
### Keep 100 percent
- **Pros**: no judgement about which lines to leave out
- **Cons**: effort goes to unreachable branches, and the number still does not prove that checks are protected
- **Why not**: the owner decided that 95 percent is enough

## Consequences
### Positive
- Effort goes to behavior tests and mutation checks instead of the last few lines.
### Negative
- Up to 5 percent of money and rules lines can be untested; review has to look at what they are.
### Risks
- The floor can be met by testing easy lines. Mitigation: reviewers run mutation experiments on money and rules changes (see `docs/foundation/ecc-usage.md`), and the CI job with `cargo-mutants` (release-and-quality-1) watches the same code.
