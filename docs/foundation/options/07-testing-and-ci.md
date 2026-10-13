---
owner: backend-engineer
status: draft
---

# Options 7: testing, quality gates and continuous integration

Inputs: priority order (integrity, security, compatibility, resource use, performance), mandatory accessibility, no local test machines, a public repository, AI maintenance. The 104 prototype tests and 8 specs are acceptance material for the rebuild.

## Layers
| Layer | What | Tooling (proposed) |
|---|---|---|
| Rules and money | Balance, rounding, scale, overflow, user-value-wins; exact arithmetic | Rust unit tests; property tests (`proptest`) for invariants; mutation testing (`cargo-mutants`) on money and rule modules |
| Database | Triggers, immutability, projection rebuild equals projection (`verify_projection`) | Rust tests on in-memory and file SQLite; a generator for the 1,000,000-entry file |
| Behavior specs | Every requirement of the prototype specs, carried, changed or dropped, each with a test id | A spec-to-test trace, as the prototype had (`RULES-TRACE`), checked by a test |
| Scenarios | Each scenario against golden entries; invalid scenarios rejected without harming the books | Table-driven tests from the scenario files |
| Crypto and sync | Known-answer vectors, signature scope, canonical CBOR golden files, rollback and fork cases, key epochs and the revoke race | Test vectors committed; a simulated server and several simulated devices; fuzzing of envelope and decimal parsers (`cargo-fuzz`) |
| Plugins | Capability absence, resource limits, no plugin holding read plus network | Host tests with hostile test plugins |
| UI | Component tests; end-to-end flows in Electron | Playwright (supports Electron); accessibility checks with axe in every flow |
| Platforms | Windows, macOS, Ubuntu | GitHub Actions matrix (free for public repositories); packaged-app smoke test on each |
| Supply chain | Locked, audited dependencies; pinned actions; provenance | `cargo-deny`, `cargo-vet`, `npm ci`, dependency review, CodeQL, secret scanning, artifact attestations |
| Performance | Recorded, never a gate (owner round 11) | Benchmarks on the 1M file writing numbers to the build log |

## Gates
- Before commit: format, lint, type check, tests with a coverage floor (80 percent overall, 100 percent on money, rules and crypto modules).
- Per change: reviewers by language (Rust, TypeScript, React), `silent-failure-hunter` and `type-design-analyzer` on money code, `security-reviewer` on keys, access, sync and plugins.
- Before a release: the full matrix, the 1M-entry run, an update-signature check, and the accessibility checklist.

## The accessibility gap (honest)
Accessibility is mandatory, but no screen reader can be automated reliably across Windows (NVDA, Narrator), macOS (VoiceOver) and Linux (Orca) in CI, and the owner has no test machines. Automated checks (axe, roles and names, focus order, keyboard-only end-to-end flows, contrast) catch much but not all. Proposal: a written manual checklist per release, run by volunteers from the open-source community and, when revenue exists, by paid testers.

## Open questions
1. Mutation testing and fuzzing as quality tools on money and crypto code (more CI time): accepted?
2. Coverage floor of 80 percent overall and 100 percent on money, rules and crypto: accepted?
3. Accessibility manual testing by volunteers and later paid testers: accepted?

## Owner round 19 and the accessibility question
The owner accepted questions 1 and 2 and asked whether accessibility should be shelved until the app is built and has many users. Assistant position: shelve the **manual screen-reader testing**, not the **building**. Accessible markup, keyboard paths, focus order and contrast cost little when done from the first screen and a great deal to retrofit; automated checks (axe, roles and names, keyboard-only flows) stay as merge gates. Manual testing with real screen readers waits for users, then volunteers and paid testers. Recorded in ADR-0018; the owner may overrule.
