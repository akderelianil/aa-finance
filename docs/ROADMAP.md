---
owner: product-lead
status: active
---

# Roadmap

Goal: a local-first, open-source family finance app that a person with no accounting knowledge can run, on a strict double-entry ledger. Vision: [foundation/vision](foundation/vision.md).

## Done
- Prototype (Oct 2026): Tauri + SQLite + TypeScript ledger with UI, members and PIN gate, 104 tests, harness (CI, ADRs, specs, trace). Retired as a code base; its specs and tests are requirements for the rebuild. The earlier Supabase version is in tag `supabase-final`.

## Now: epic `foundation-reset` (sprint 5)
1. Discovery interview: done.
2. Audit of old decisions and docs: [audit](foundation/audit.md).
3. Vision.
4. Backend options and research: core language, UI/shell, amounts, sync and server, keys, plugins.
5. ADRs and technical design with diagrams.
6. Migration plan and follow-up epics.

## Next epics (to be created in story 6)
- Backend rebuild (v1 core): ledger, scenarios engine, roles, backup and export.
- UI rebuild on the chosen technology.
- Investments release.
- Sync and server (paid tier).

## Later
See the release table in the [vision](foundation/vision.md#goals-by-release) and [backlog](foundation/backlog.md).
