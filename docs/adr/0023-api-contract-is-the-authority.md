# ADR-0023: The API contract file is the authority

**Date**: 2026-10-17
**Status**: accepted
**Deciders**: product owner, in the session of 2026-10-17 (options weighed with the `api-design` and `contract-first` skills)

**Relation**: Fills in the "versioned, JSON-shaped set of named operations" of [ADR-0008](0008-shared-rust-core.md); error codes follow [ADR-0021](0021-sealed-ledger-kernel.md).

## Context
The UI, the command line and plugins call the core only through named operations (ADR-0008). That boundary becomes a public contract once plugins exist. If the Rust code is the only place that says which operations and fields exist, the documentation, the TypeScript side and the plugins each guess, and they drift.

## Decision
One version-controlled file, `api/v1/api.json` (JSON Schema 2020-12 with an `operations` map), is the authority: for each operation its name, summary, input, output and the error codes it can return, plus shared shapes and the list of every error code. The core follows the file, not the other way round. A change starts in the file, then the code.

- `Ledger::call(name, json) -> json` (module `api`) is the one entry the UI, the CLI and plugins use. Input and output are JSON; amounts and ids are strings (ADR-0009); unknown fields are refused (`invalid_input`); an unknown name is `unknown_operation`.
- A failure crosses the API as `{ "error": { "code", "message" } }`: a stable code and fixed text in the asked language, never database or internal text.
- One API version for all operations (`api_version`, now `1`). Adding an operation, an optional input field or an output field keeps the version. Removing or renaming a field, changing a type or tightening an input is breaking and needs a new version; at most two versions live together, with notice before one goes.
- The contract does not copy the rules. It states shapes; a rule such as "an entry needs two lines" stays a rule code with a clear message, not a schema constraint.
- The readable reference `docs/api/v1.md` is generated from the file (`npm run api:docs`); `npm run verify` fails when it is stale.
- Tests (`crates/core/tests/api/`) hold the core to the file: the same set of operations; every success fits the output schema; every failure is an error envelope with a code that operation lists; a bad input is refused by the dispatcher exactly when the schema rejects it. A unit test checks that the file's error codes are exactly the codes of the core.

## Alternatives Considered
### A Rust table as the authority, schemas generated from it
- **Pros**: no hand-written schema.
- **Cons**: the provider designs the contract alone and the file records what happened; consumers cannot work in parallel against it.
- **Why not**: contract-first keeps one artifact that both sides verify against.

### A schema library on the production types (`schemars`)
- **Pros**: fields cannot be forgotten.
- **Cons**: a production dependency in the core; the schema follows storage-minded types.
- **Why not**: the owner chose the contract file; the test-only validator is enough.

## Consequences
### Positive
- One place says what the boundary is; the docs and later the TypeScript types derive from it.
- Drift is a failing test, not a surprise.

### Negative
- The schemas are written by hand and kept in step with the Rust input and view types.

### Risks
- TypeScript types for the UI are not generated yet; they come with the desktop UI epic, from this file.
- `history` returns the whole list; a cursor and a head or branch marker come later as additive fields.
