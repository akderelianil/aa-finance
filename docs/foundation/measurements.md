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
| 2026-10-14 | Line coverage of `crates/core` | 99.4 percent. Every line is covered except `store.rs` line 70 (`foreign keys could not be enabled`): it needs a SQLite built without foreign-key support, which cannot be simulated. Owner accepted this one exception on 2026-10-14. |
| 2026-10-14 | Region coverage of `crates/core` | The uncovered regions left inside covered lines are the error arm of `?` on a database call that cannot fail on a healthy file (a failing read of a column that the schema guarantees, a failing `query_map` with no parameters). Failures of whole statements are tested by damaging the schema (see `tests/store/failures.rs`). |

Reproduce: `cargo run --release -p aa-core --example gen_fixture -- fixture.db 1000000`.
