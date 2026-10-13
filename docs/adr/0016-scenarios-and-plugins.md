# ADR-0016: Scenarios as data; sandboxed, permissioned WebAssembly plugins

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: New decision.

## Context
The UI must speak daily language while the books stay correct; developers and the community must extend the app; the plugin model must not undo end-to-end encryption.

## Decision
A scenario is a JSON document validated by a schema: typed input fields from a small fixed set, derived values in a safe expression language (CEL, to be verified: licence and release cadence; fallback is a minimal grammar of our own) plus named official calculators (loan schedule, instalment split, interest, cross rate, lot consumption), output lines and optional plan items, a plain preview sentence, and the accounting lines for expert mode. The core validates the produced draft like any entry; each platform renders the form natively. Packs are signed sets of scenarios and locale strings; community packs are allowed from the start through reviewed pull requests; the first pack is Gider, Gelir, Transfer, Borç. Plugins that run code are WebAssembly modules in the Rust core (wasmtime), built with the Component Model first. A plugin gets only the host functions in its manifest: `ledger.read` (only what the acting member may read), `proposals.submit` (entries wait for user approval; prices from providers are inserted automatically, marked fetched, and a user-given price outranks them), `http.fetch` (read-only HTTPS to allow-listed domains with limits), and a private key-value store. No file system, no raw SQL. Memory, instruction budget and time are capped. No plugin holds both `ledger.read` and `http.fetch`. The manifest lists id, version, publisher, API version, permissions in plain words, hashes and a signature; only plugins from the owner's registry install at first, hash-pinned. Plugin writes carry the plugin id and the acting member. UI plugins are not planned soon. The named operations are the public API, versioned.

## Alternatives Considered
### Scenarios in Rust code
- **Pros**: Full power
- **Cons**: Only developers can add them; bigger attack surface
- **Why not**: Rejected

### An embedded scripting language
- **Pros**: Flexible
- **Cons**: Unbounded power
- **Why not**: Rejected

### Extism for plugins
- **Pros**: Many language SDKs
- **Cons**: Runtime-checked capabilities
- **Why not**: Revisit if outside authors need easier tooling


## Consequences
### Positive
- Community can contribute scenario packs without touching the core.
- Plugins cannot leak the ledger or post entries.

### Negative
- A strict field set limits what a scenario can ask.
- Plugin authors get less power than in Obsidian, by design.

### Risks
- The WebAssembly evidence is thin (no 2026 benchmarks found); decide the final runtime in a small prototype.
