# ADR-0018: Quality gates, test layers and release security

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: New decision.

## Context
Integrity and security come first. The repository will be public. The owner has no test machines and no signing budget yet. Independent review ranked a tampered installer or update as the top threat.

## Decision
Tests: unit and property tests for money and rules; mutation testing (`cargo-mutants`) and fuzzing (`cargo-fuzz`) on money, crypto and parsers; database tests including `verify_projection` on a generated 1,000,000-entry file; a spec-to-test trace carrying the prototype specs; scenario golden tests; crypto test vectors and golden files for the canonical encoding; simulated devices and server for rollback, fork, epoch and revoke-race cases; hostile test plugins; component tests, Playwright end-to-end on Electron, and axe checks in every flow; a GitHub Actions matrix on Windows, macOS and Ubuntu. Coverage floor: 80 percent overall, 100 percent on money, rules and crypto. Performance is recorded, never a gate. Accessibility: the UI is built accessibly from the first screen (semantic markup, keyboard paths, focus order, contrast) and automated checks gate merges; manual screen-reader testing is deferred until the product has users, then done by volunteers and paid testers (assistant position on the owner's question; deferring the building is not accepted because retrofitting costs far more). Release security: an independent update-signing key (Ed25519 or minisign) pinned in the app and verified by the client; reproducible CI builds with provenance attestations; hardware-key 2FA on release credentials; lockfiles, `npm ci`, `cargo-deny`, `cargo-vet`, no install scripts, Actions pinned by SHA, minimal CI secrets, no secrets for fork pull requests, Electron kept current. Gate: paid sync does not launch before Windows signing (SignPath Foundation if the project qualifies) and the Apple Developer ID are in place; the first local release may ship unsigned from GitHub Releases for the family and early users. Reviews by language, `silent-failure-hunter` and `type-design-analyzer` on money code, `security-reviewer` on keys, access, sync and plugins.

## Alternatives Considered
### Performance gates now
- **Pros**: Prevents regressions
- **Cons**: Constrains quality-first building (owner round 11)
- **Why not**: Record only

### Defer all accessibility work
- **Pros**: Saves effort now
- **Cons**: Retrofitting is far costlier; accessibility is a stated requirement
- **Why not**: Only manual testing is deferred


## Consequences
### Positive
- Money, crypto and sync code is held to a higher standard than the rest.
- A public repository gets standard supply-chain protection.

### Negative
- More CI time.
- No automated screen-reader coverage.

### Risks
- Unsigned first release: a lookalike installer is possible; the signing gate protects the paid launch.
