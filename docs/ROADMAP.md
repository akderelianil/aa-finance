---
owner: product-lead
status: active
---

# Roadmap

Goal: a local-first, open-source family finance app that a person with no accounting knowledge can run, on a strict double-entry ledger. Vision: [foundation/vision](foundation/vision.md).

## Done
- Prototype (Oct 2026): Tauri + SQLite + TypeScript ledger with UI, members and PIN gate, 104 tests, harness (CI, ADRs, specs, trace). Retired as a code base and deleted from `main` on 2026-10-14; its specs are requirements for the rebuild and the tree is kept in the git tag `prototype-final`. The earlier Supabase version is in tag `supabase-final`.

## Now: sprint 6 (rebuild), started 2026-10-14
Epic `foundation-reset` is closed and approved. Done: `core-rebuild-1` (repository move, Rust workspace, CI), `core-rebuild-2` (schema v1, revisions, projection, `verify_projection`; 1,000,000 entries verify clean in about 8 s, see [measurements](foundation/measurements.md)) `core-rebuild-3` (exact amounts, rates, rounding line) and `core-rebuild-4` (ledger operations, undo and redo, delete, settings, history marks, the API contract [ADR-0023](adr/0023-api-contract-is-the-authority.md)). Next: `core-rebuild-5` (scenario engine), `release-and-quality-1` (CI floors, mutation and fuzz jobs) and, before sync work, `core-rebuild-11` (needs-attention state, idempotent import).

## Next (sprint 7)
`core-rebuild-5` scenario engine with Gider, Gelir, Transfer, Borç. Then reports, local roles, backup and export, spec parity, command line; the desktop app in the `desktop-ui` epic.

## Later
Epics `investments`, `sync-and-server` (signing gate first), `mobile-and-reminders`; see the release table in the [vision](foundation/vision.md#goals-by-release) and the [backlog](foundation/backlog.md).
