---
owner: product-lead
status: active
---

# Roadmap

Goal: a local-first, open-source family finance app that a person with no accounting knowledge can run, on a strict double-entry ledger. Vision: [foundation/vision](foundation/vision.md).

## Done
- Prototype (Oct 2026): Tauri + SQLite + TypeScript ledger with UI, members and PIN gate, 104 tests, harness (CI, ADRs, specs, trace). Retired as a code base; its specs and tests are requirements for the rebuild. The earlier Supabase version is in tag `supabase-final`.

## Now: sprint 6 (rebuild), started 2026-10-14
Epic `foundation-reset` is closed and approved. Done: `core-rebuild-1` (repository move, Rust workspace, three-OS CI). In review: `core-rebuild-2` (schema v1, revisions, projection, `verify_projection`; 1,000,000 entries verify clean in about 8 s, see [measurements](foundation/measurements.md)). Next in the sprint: `core-rebuild-3` (amounts, rounding, rates) and `release-and-quality-1` (CI floors, mutation and fuzz jobs).

## Next (sprint 7)
`core-rebuild-4` ledger operations and the named-operation API, `core-rebuild-5` scenario engine with Gider, Gelir, Transfer, Borç. Then reports, local roles, backup and export, spec parity, command line; the desktop app in the `desktop-ui` epic.

## Later
Epics `investments`, `sync-and-server` (signing gate first), `mobile-and-reminders`; see the release table in the [vision](foundation/vision.md#goals-by-release) and the [backlog](foundation/backlog.md).
