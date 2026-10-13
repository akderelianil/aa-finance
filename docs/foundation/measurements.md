---
owner: backend-engineer
status: active
---

# Measurements (recorded, never a gate)

Owner decision (round 11): performance is measured and recorded, optimized later from numbers. Machine: WSL2 on the owner's PC, release build, SQLite in WAL mode with synchronous FULL. Other jobs were running at the same time, so treat figures as rough.

| Date | What | Result |
|---|---|---|
| 2026-10-14 | Generate 1,000,000 posted entries (about 2.2 million lines) through the revision writer, in batches of 5,000 | 206 s on an idle machine, 404 s while a coverage run shared the CPU |
| 2026-10-14 | `verify_projection` over that file | 5.5 to 8 s, 0 drifts |
| 2026-10-14 | Size of that ledger file | about 774 MB |
| 2026-10-14 | Line coverage of `crates/core` | 96 percent (the rest are defensive branches that the API cannot reach) |

Reproduce: `cargo run --release -p aa-core --example gen_fixture -- fixture.db 1000000`.
