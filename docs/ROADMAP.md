---
owner: product-lead
status: active
---

# Roadmap

Goal: a local-first, open-source family finance app that a person with no accounting knowledge can run, on a strict double-entry ledger. Vision: [foundation/vision](foundation/vision.md).

## Done
- Prototype (Oct 2026): Tauri + SQLite + TypeScript ledger with UI, members and PIN gate, 104 tests, harness (CI, ADRs, specs, trace). Retired as a code base; its specs and tests are requirements for the rebuild. The earlier Supabase version is in tag `supabase-final`.

## Now: epic `foundation-reset` (sprint 5), closing
Done: interview, audit, vision, options 1 to 7, ADR 0008 to 0019, technical design, migration plan. Waiting for the owner's approval of the ADRs.

## Next (sprints 6 and 7)
- Sprint 6: `core-rebuild-1` repository move, `-2` schema v1 with revisions and `verify_projection`, `-3` amounts and rounding, `release-and-quality-1` CI matrix and gates.
- Sprint 7: `core-rebuild-4` ledger operations and the named-operation API, `-5` scenario engine with Gider, Gelir, Transfer, Borç.
- Then: reports, local roles, backup and export, spec parity, command line; the desktop app in the `desktop-ui` epic.

## Later
Epics `investments`, `sync-and-server` (signing gate first), `mobile-and-reminders`; see the release table in the [vision](foundation/vision.md#goals-by-release) and the [backlog](foundation/backlog.md).
