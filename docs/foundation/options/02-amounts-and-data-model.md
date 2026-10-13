---
owner: backend-engineer
status: reviewed (2026-10-13)
---

# Options 2: amounts, ids, history and the event log

Inputs: [vision](../vision.md), [options 1](01-core-and-ui.md). Needs: exact money and commodities (gold, shares, crypto), 100k to 1M entries, sync-ready from v1, append-only history, user-given values win.

## A. How an amount is stored
The prototype used JavaScript numbers in minor units. Commodities break it: crypto has up to 18 decimals, some tokens are held in trillions.

| Option | For | Against |
|---|---|---|
| **A1. Signed 64-bit integer with a per-commodity scale** (recommended) | Exact; SQLite `SUM` and indexes work on it; fast at 1M rows; SQLite's `sum()` raises "integer overflow" instead of silently wrapping ([SQLite aggregate docs](https://www.sqlite.org/lang_aggfunc.html)); `total()` would hide it, so the app never uses it | Range is 9.22e18 units: pick the scale per commodity so holdings fit |
| A2. 128-bit integer (two columns or a blob) | Huge range | No SQL `SUM`; every total needs application code or extra tables |
| A3. Decimal text | Any precision | No sorting or summing in SQL; slow; error-prone |
| A4. Floats | | Never for money |

Scale rule: a commodity has a `scale` (decimal places) chosen for accounting, not copied from the chain. Choose it so `largest plausible holding x 10^scale < 9.2e18 / 1000`. Examples: BTC scale 8 (21 million coins = 2.1e15); ETH scale 9 (gwei); a trillion-supply token scale 0 to 3; USD, TRY scale 2; gold in grams scale 4. Amounts finer than the scale are rounded at entry and recorded as an explicit rounding line ("dust") so the books still balance. Rates and prices stay decimal text with high precision; arithmetic happens in the Rust core on exact decimals, with one rounding rule (half away from zero).

A line stores `quantity` (commodity units, scaled) and `base_value` (book currency, scaled); balance holds on `base_value`, as GnuCash balances on value. The user-given rate or base amount wins, as before.

## B. Identity
| Option | For | Against |
|---|---|---|
| **UUIDv7 as a 16-byte blob** (recommended) | Created offline without clashes; time-ordered so inserts stay near the end of the index | 16 bytes per key; ids are not human-friendly |
| ULID text | Readable | Larger, slower |
| Integer + device prefix | Compact | Fragile when devices merge or a file is copied |

Human-friendly numbers: sequential, gapless "Yevmiye numbers" cannot exist across offline devices. Option: drop them, show date order plus a short stable id and an optional user "Num" field (no tax law needs gapless numbers for a personal ledger). The prototype renumbered per year.

## C. History and the event log
| Option | For | Against |
|---|---|---|
| **C1. Revisions as truth, current state indexed** (recommended) | Each entry (and account, price, setting) is an immutable document with a revision number; the latest accepted revision is the current one; lines of the current revision sit in indexed tables for fast sums; the same revision is what E2EE sync ships; undo = a new revision | Two shapes of data to keep consistent (triggers do it) |
| C2. Pure event sourcing | Elegant | Rebuilding projections at 1M entries; harder to enforce rules in the database |
| C3. State tables plus a change log of patches | Familiar | Patches are fragile to merge and to encrypt |

Conflicts: two revisions with the same parent. The server keeps the first accepted; the other is stored as a conflict branch, shown to the user, never dropped. The activity history is a view over revisions with author and time. Ordering uses a hybrid logical clock for display and the server order for conflicts.

## D. Open design questions for the owner
1. Gapless entry numbers: drop them (recommended)?
2. Dust rounding for amounts finer than the commodity scale: accepted?
3. History for every user-made thing (accounts, prices, settings, members) and not only entries (recommended)?
4. Period lock (close a month or year): keep as an admin option? A late edit from an old device then becomes a conflict.
5. Book currency: fixed for the life of a ledger (reports can show any unit). A family that emigrates would start a new book or use a later re-base tool. Accepted?
6. Accounts and commodities in use can be archived, never deleted. Accepted?

## Review of 2026-10-13 and the revised design
Two independent reviews (database-reviewer for SQLite, architect for the whole design) found no fatal flaw but several gaps. Decisions below replace the matching recommendations above. Items needing the owner are in the interview, round 13.

### Changes to my own earlier recommendations
- **Ids:** random 128-bit ids (UUIDv4) as global ids, plus ordinary integer rowids inside the database. UUIDv7 would leak creation times to a server that is meant to be blind, and index locality does not matter once big tables use rowids. The `line` table needs no global id of its own (a line belongs to a revision).
- **"Triggers keep revisions and projection consistent" is withdrawn.** One Rust function writes the revision and rebuilds the projection in one transaction. Triggers stay only as invariants: revisions are immutable, a posted entry balances exactly, archived commodities and accounts cannot take new lines, scale is immutable once used.

### Blocking points and how they are resolved
1. **Balancing and rounding.** One signed `base_value` per line (debit positive, credit negative); a posted entry must sum to exactly zero, no tolerance. The core computes `base_value` from quantity and rate (the user-given rate or base amount wins), and adds an explicit rounding line to a system account "Rounding" in the book currency when per-line rounding leaves one minor unit. Sub-scale input ("dust") uses the same line. A later rate can never change a posted `base_value`; that needs a new revision.
2. **No deferred triggers in SQLite.** The balance trigger fires when the revision moves from `draft` to `posted`, not per inserted line; after that, line rows are immutable.
3. **Two layers.** The revision store accepts any well-formed, authorized revision and keeps it forever. Only the projection (current lines) is guarded by rules. A revision that fails the projection (account archived, period locked, grant revoked, older rules) gets a visible state "needs attention" and is never dropped; devices still agree because validation is deterministic Rust code, with `rules_version` stored on each revision. `current_revision_id` is a pointer updated with the projection in one transaction; conflict branches never touch it. A `verify_projection` command rebuilds the projection from revisions and compares; it runs in backup verification and CI on the 1M-entry file.
4. **RBAC with E2EE.** Each revision has a shared part (lines with base_value and a masked counter-account token) and a restricted part (the real counter-account and memo), each under its own key wrapped for the readers. A member who sees only part of an entry can view it but not edit it. A revoke stops access to future revisions; data already synced to a device cannot be unseen. Reports for a restricted viewer carry a "hidden counterpart" bucket so statements still balance. The masked-line shape is in the v1 schema even though v1 is local.
5. **Lock and ordering.** "Locked at the time" is decided by server order, not by entry date or clock. A late edit into a locked period is held as a conflict for an admin; it never silently changes reported totals. Closing a period posts no entries (it freezes edits).

### Important points
- **Amounts over IPC:** int64 values cross to the UI and plugins as decimal strings (or BigInt), never JavaScript numbers; a lint rule forbids `Number()` on amounts.
- **Overflow by construction:** CHECK constraints bound `quantity` and `base_value`; report aggregation in the core uses checked i128; SQL `sum()` keeps throwing on overflow, `total()` is never used. Scale is stored per commodity and is immutable once used (a rewrite tool may change it).
- **Quantity balance:** the entry balances on `base_value`. Same-commodity moves (BTC wallet to wallet plus fee) and exchanges between commodities are modelled with GnuCash-style trading accounts created invisibly by the scenario engine so quantities also balance per commodity; the ADR confirms the exact rule.
- **Keys and tables:** `STRICT` tables, `foreign_keys=ON`, WAL, `synchronous=FULL`, `user_version`; `schema_version` and `core_version` on each revision.
- **Balances:** no balance table in v1; a covering index `(account_id, commodity_id, date, quantity, base_value)`; a monthly balance table maintained by the core is added only if measurements demand it. Valuation at the latest price is a read-time join.
- **Lots:** specific-lot choices are user data stored in the revision; realized and unrealized gains are derived and never stored as truth; a partly consumed lot splits `base_value` with the residual to the last piece; fees add to basis or to expense by scenario; splits and account-to-account transfers carry basis.
- **Prices:** keyed by `(commodity, quote, date, source)`; a user-given price outranks a fetched one; one defined path rule for cross rates; the price used when posting is frozen into `base_value`, while reports use the latest price; a unit conversion table (gram, ounce).
- **Sync fields:** revisions are keyed by their own id with `parent_id`; `server_seq` is empty until accepted; HLC stored as a sortable value; the register orders by entry date, then creation time, then id.
- **Erasure:** append-only triggers block `DELETE`, so erasure is a separate wipe path: local file and cloud copies deleted, keys destroyed (crypto-shredding), tombstones for what the family keeps. Scope of who may erase what is an owner question.
- **Canonical serialization and hash** of a revision are fixed before the first release; a hash chain cannot be added later.
- **Decimal library:** `rust_decimal` has a 96-bit mantissa; check it against 18-decimal crypto, or use scaled i128 arithmetic.

### Process and integration (from the architect, also for options 01)
- One Rust core crate with one named-operation API (JSON-shaped). Desktop: the core runs in an Electron `utilityProcess` (a crash must not kill the UI). CLI: a separate Rust binary that links the same core. Both write the same WAL file with `BEGIN IMMEDIATE` and a busy timeout; HLC and revision counters are safe across processes.
- The shell stays swappable only if the UI never imports Electron APIs: enforce with a lint boundary.
- Plugin and scenario writes carry author and plugin id in the revision (activity history).
- The CLI must authenticate: a local token tied to a member, with that member's permissions.

### Not verified
Query timings and index sizes at 3M lines (no benchmark yet); `rust_decimal` behaviour at 18 decimals; napi-rs and `utilityProcess` behaviour against current documentation.
