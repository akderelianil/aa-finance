# Legacy prototype (frozen)

The first version of aa-finance: Tauri 2 + SQLite + TypeScript core + React/ReUI. It is frozen at tag `prototype-final` plus the move into this folder. Do not add features here. It stays for two reasons:

1. Its tests and the specs in `../docs/backend/specs/` are the acceptance source for the rebuild ([migration plan](../docs/foundation/migration-plan.md), story `core-rebuild-9`).
2. Its operation names and error codes seed the new API vocabulary.

It is deleted when the rebuilt core reaches spec parity; the tag keeps it.

## Run its checks
From the repository root: `npm run verify` (this folder's web checks plus the repo scripts) and `npm run verify:rust-legacy`. Inside this folder: `npm ci`, then `npm run verify:web`.

Code paths quoted in the specs and in `../docs/RULES-TRACE.md` (`src/core/...`, `src-tauri/...`) live under this folder.
