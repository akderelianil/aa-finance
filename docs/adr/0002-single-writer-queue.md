# ADR-0002: Single-writer queue and `max(id)+1` ids

**Date**: 2026-10-13 (recorded from the code)
**Status**: accepted
**Deciders**: backend

## Context
Write operations read before they write (next entry id, owner, rate), then write in one batch. Two writes at once could read the same state. The app is one process with one window and one SQLite file.

## Decision
`createApi` runs write operations one after another through a promise queue (`inTurn` in `src/core/api/index.ts`). Entry ids are `max(id) + 1`; ids only grow because rows are never deleted ([ADR-0005](0005-soft-delete-and-audit.md)). Each write commits as one `db.batch` that includes its `activity_log` row.

## Alternatives Considered
### Database sequences or `AUTOINCREMENT`
- **Pros**: no race by design.
- **Cons**: ids are only known after insert; the batch needs the id for its lines.
- **Why not**: allocating first keeps the batch self-contained.

### Optimistic retry on conflict
- **Pros**: allows parallel writes.
- **Cons**: complex, no benefit for one writer.
- **Why not**: a queue is a few lines and removes the case.

## Consequences
### Positive
- Simple, deterministic writes; tests cover concurrent calls ("writes at the same time run one after another").

### Negative
- Writes are serial; fine for a family ledger.

### Risks
- A second process or window on the same file, or future sync, breaks the id rule. Mitigation: revisit this ADR before any of those; the entry-number trigger and unique constraints still reject duplicates.
