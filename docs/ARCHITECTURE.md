---
owner: product-lead
status: active
---

# Architecture

The architecture is being rebuilt in epic `foundation-reset`. Product direction: [vision](foundation/vision.md). Decisions so far and what is open: [foundation](foundation/README.md), [audit](foundation/audit.md). Rule list: [CLAUDE.md](../CLAUDE.md#product-rules).

## Fixed by the interview
- Strict double entry in the database; the API checks first; append-only revisions with an event log.
- Local first with a sync-ready model (global ids); paid E2EE sync later; first writer wins, the loser is kept as a conflict.
- Per-account roles; the admin sees every account; real separation only across devices.
- Sandboxed, permissioned plugins on a public, versioned API; scenarios are data.

## Open (story 4 of the epic)
Shared core language, UI and shell technology, amount storage for crypto and commodities, sync protocol and server shape, key hierarchy, notification service, plugin sandbox.

## Legacy
The prototype design (Tauri + SQLite + TypeScript, single writer, PIN gate, admin grants) is described in [prototype architecture](https://github.com/akderelianil/aa-finance/blob/prototype-final/docs/backend/architecture/overview.md) (git tag `prototype-final`) and ADR 0001 to 0007, marked legacy or under review.
