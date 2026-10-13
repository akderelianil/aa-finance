---
owner: backend-engineer
status: draft
---

# Options 5: the scenario engine and the plugin system

Inputs: [vision](../vision.md), [options 4](04-keys-identity-and-access.md) (threat model), interview. Owner rules: scenarios are data; plugins are sandboxed, permissioned, official-only at first, with no visual plugins soon; every write passes the same named API and rules; CLI and UI share the API.

## A. Scenario templates (data)
A scenario turns plain questions into a correct entry (and sometimes plan items). It is a JSON document, validated against a schema, with no code in it.

| Part | Content |
|---|---|
| Identity | id, version, schema version, `requires` engine version, applicable countries, display strings per locale |
| Inputs | typed fields from a small fixed set: money, quantity, commodity, account (with a filter such as "an asset or liability account"), contact, date, text, choice, toggle, number, percent, repeat group; steps and grouping hints only |
| Derived values | expressions in a safe expression language (no loops, no I/O, bounded cost) and named calculators from the core (loan schedule, instalment split, interest, cross rate, lot consumption) |
| Output | lines of the entry (account, commodity, quantity, base value rules), optional plan items (future payments), a plain-language preview sentence, and the accounting lines shown in expert mode |
| Checks | rules over inputs with plain messages |

The engine produces a draft; the core still validates it exactly like any entry (balance, permissions, archived accounts, locks). A faulty scenario can be rejected but cannot corrupt the books. Each platform draws the form natively from the field list, which is why that list stays small and stable.

**Expression language.** Recommended: CEL (Common Expression Language), non-Turing complete and designed for safe embedding; a Rust interpreter (`cel`, 0.14.x) is actively developed and was presented at FOSDEM 2026 ([talk](https://fosdem.org/2026/schedule/event/rust-cel)). Not verified: its licence, release cadence and open issues; there are several forks and an older crate name, so check before adding it. Fallback: a minimal expression grammar of our own. Rejected: embedded scripting languages (power not needed, bigger attack surface).

**Packs and the first pack.** A pack is a signed set of scenarios plus locale strings. First pack: Gider, Gelir, Transfer, Borç (the owner's urgent four). Next: loan, card instalments, exchange, investment. Country packs (a Turkish bank loan with its taxes) use parameters or an official calculator.

## B. Plugins
| Kind | Code? | When |
|---|---|---|
| Scenario packs | No, data only | First; contributions reviewed as pull requests |
| Data providers (prices, rates) | WebAssembly | After v1 |
| Importers and exporters | WebAssembly | After v1 |
| UI panels | | Not planned soon |

**Runtime.** WebAssembly inside the Rust core (wasmtime). Capabilities are granted by what the host exposes: a plugin gets only the host functions its manifest lists. Two ways to build the contract: the Component Model with typed WIT interfaces (capability gating by absence, strong typing) or Extism (many language SDKs, runtime-checked capabilities). Recommended: Component Model for the first official plugins; revisit Extism if outside authors need easier tooling. Evidence is thin (a crate's design notes and a forum thread; [notes](https://docs.rs/crate/uni-plugin-extism/3.2.0)); no 2026 benchmarks or release status were found.

**Host functions (the only authority a plugin has).**
- `ledger.read`: reads only what the acting member may read, minimized to what the plugin type needs.
- `proposals.submit`: a plugin proposes entries or prices. Entries land as drafts the user approves; plugins never post.
- `http.fetch`: the host performs a read-only HTTPS request to a domain on the manifest allow-list, with size and time limits, no cookies; the plugin never sees a socket.
- `storage`: a private key-value area per plugin.
- No file system, no raw SQL, no clock control. Memory, instruction budget (fuel) and wall time are capped.

**Manifest and trust.** Id, version, publisher, API version, a human-readable permission list shown at install, content hashes, publisher signature. A client installs only plugins from the owner's registry at first and pins the hash; an update is a new review.

**Design rule that came from the threat model.** No plugin holds both `ledger.read` and `http.fetch`. A data provider needs the list of commodities and dates, not the ledger; an importer needs a file the user picks, not a network. Official exceptions need a written reason.

**Identity and history.** Every plugin write carries the plugin id and the acting member, so the activity history shows who proposed what. Plugin permissions are revocable per plugin.

**Public API.** The named operations used by the UI and CLI are the public API, versioned with semantic versions, a deprecation policy and conformance tests. UI panels and a wider API come after the product matures.

## Open questions for the owner
1. Community scenario packs allowed from the start, reviewed as pull requests to the official repository?
2. Prices from a provider plugin inserted automatically (marked as fetched; a user-given price still outranks it) while entries always wait for approval?
3. The rule "no plugin holds ledger read and network together": accepted?
