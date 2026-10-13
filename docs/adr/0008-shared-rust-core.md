# ADR-0008: One shared Rust core behind a named-operation API

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: Supersedes the TypeScript-core part of [ADR-0001](0001-local-first-sqlite-thin-rust.md).

## Context
The product needs one implementation of the ledger rules, scenarios, amount arithmetic, encryption, sync client and plugin host for a desktop app, a command line, a background reminder helper and, later, native iOS and Android. A TypeScript core cannot be reused by native mobile. Claude Code maintains all code, so there must be one place for each rule.

## Decision
The core is a Rust library. It owns SQLite (bundled, WAL, `STRICT` tables, `foreign_keys=ON`, `synchronous=FULL`, `user_version`), all rules, the scenario engine, revisions, backup and verification, key handling and the sync client. It exposes one versioned, JSON-shaped set of named operations; the UI, the CLI and plugins call only those. It runs in an Electron `utilityProcess` for the desktop app, inside a separate command-line binary, read-only in the reminder helper, and through UniFFI in mobile apps later. Several processes may open the same file: writers use `BEGIN IMMEDIATE` with a busy timeout; counters and clocks are safe across processes. Triggers remain only as the last guard for invariants (see ADR-0012). Amounts cross to JavaScript as decimal strings, never numbers.

## Alternatives Considered
### Keep the TypeScript core
- **Pros**: Fast to write, shared with the UI
- **Cons**: Mobile cannot reuse it; weak for exact arithmetic and crypto
- **Why not**: Rules would be written twice

### Kotlin Multiplatform
- **Pros**: One core for Android, iOS, desktop
- **Cons**: JVM weight on desktop; weaker WASM and crypto story
- **Why not**: No gain over Rust

### Dart (Flutter)
- **Pros**: One language for core and UI
- **Cons**: Core tied to a UI framework
- **Why not**: A sync and crypto core should outlive any UI


## Consequences
### Positive
- One implementation of every rule on every platform.
- Memory safety and strong types for money code.
- A command line and a reminder helper come cheaply.

### Negative
- The prototype core is rewritten; its tests and specs become acceptance material.
- Slower first months and longer compile cycles.
- Multi-process access to one WAL file needs care.

### Risks
- A narrow API is a public contract once plugins exist: version it from the first release.
