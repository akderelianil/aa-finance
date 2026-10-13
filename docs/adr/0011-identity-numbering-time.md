# ADR-0011: Global ids, no gapless numbers, civil dates

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: Supersedes [ADR-0002](0002-single-writer-queue.md).

## Context
Several offline devices must create records without clashes. Gapless sequential numbers cannot exist across offline devices, and a personal ledger has no legal need for them. Dates must not shift with time zones; users may want other calendars for display.

## Decision
Global ids are UUIDv7 (time-ordered; the owner does not count creation time as a meaningful leak, and the server sees arrival times anyway), stored as 16-byte blobs with a length CHECK. Big tables (lines) use ordinary integer rowids and no global id. The short display id uses the random tail, not the timestamp head. There is no mandatory entry number; entries show date, a short id, and an optional free text "No" field (for example an invoice number; not unique). Dates are civil Gregorian `YYYY-MM-DD` without a time zone; other calendars are display only; fiscal-year start is a family setting. Audit timestamps are UTC. A hybrid logical clock orders sync events; the register orders by entry date, then creation time, then id. Writes on one file are serialized by `BEGIN IMMEDIATE` with a busy timeout.

## Alternatives Considered
### Integer ids with a device prefix
- **Pros**: Compact
- **Cons**: Fragile when files merge or copy
- **Why not**: Rejected

### Random UUIDv4
- **Pros**: No time information
- **Cons**: No locality; the leak is not a concern
- **Why not**: Not needed

### Per-year gapless numbers (prototype)
- **Pros**: Familiar
- **Cons**: Impossible offline
- **Why not**: Dropped


## Consequences
### Positive
- Offline creation without clashes.
- Simple, stable ids for plugins and the CLI.

### Negative
- Users lose the familiar journal number; the optional No field replaces it.

### Risks
- Clock skew on offline devices: ordering uses server order for conflicts, never the id or clock alone.
