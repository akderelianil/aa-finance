---
owner: backend-engineer
status: draft
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
