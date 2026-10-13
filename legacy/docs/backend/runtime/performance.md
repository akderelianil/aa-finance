---
owner: backend-engineer
status: active
---

# Budgets

Check each phase.

- Cold start under 1 s. Idle RAM under 150 MB. First bundle under 500 KB compressed.
- Reads and reports on 10k entries (20k lines) under 200 ms (`npm run bench`).
- Grids use SQL paging (ReUI `data-grid` with `manualPagination`). Virtualization comes later if needed.
- Keep IPC calls few: one call per operation, not one per row.

## Measured (release build on WSL2 + WSLg, no GPU; API on `node:sqlite`, 10k entries)
| Check | Result |
|---|---|
| Process start → database open and migrated | 440–480 ms |
| One IPC round trip (`SELECT 1`) | 0.4 ms |
| Binary / first bundle (gzip) | 4.7 MB / 69 KB |
| Idle memory, PSS (app + WebKit) | 360 MB; 245 MB with `WEBKIT_DISABLE_COMPOSITING_MODE=1` |
| `entries.post` × 10k, one at a time | 7.3 s |
| `accounts.list` / `entries.list` page / search | 3 / 1 / 4 ms |
| Register, 10k lines: first / last page | 2 / 19 ms |
| Trial balance / balance sheet / one-year income statement | 4 / 9 / 2 ms |

Idle memory misses the budget on WSL (WebKitGTK with software rendering). The product owner accepts it; optimize after v1 works.
