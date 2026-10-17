# ADR-0012: Immutable revisions, a projection, and conflicts that are kept

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: Supersedes [ADR-0005](0005-soft-delete-and-audit.md).

## Context
The owner wants no lost record, undo, an activity history, conflict handling that never drops an edit, history for every user-made thing, a period lock at the admin's choice, and a sync-ready model from v1.

## Decision
Every user-made thing (entry, account, commodity, price, setting, member, grant) is stored as immutable revisions: a revision id, a parent id, an author, a plugin id when relevant, `rules_version`, `schema_version`, `core_version`, a server sequence that is empty until accepted. The current state lives in indexed projection tables with a `current_revision_id` pointer. One Rust function writes a revision and rebuilds its projection in one transaction; triggers are only invariants (revisions are immutable, a posted entry balances, archived commodities and accounts take no new lines, scale is immutable). A revision that fails the projection (archived account, locked period, revoked grant, older rules) is kept in a visible "needs attention" state, never dropped. Two revisions with the same parent are a conflict: the earliest by server order is the head, the other is kept as a branch and merged by a new revision. Delete is a tombstone revision; undo is a new revision. An archived account or commodity is never deleted. The activity history is a view over revisions. A period lock freezes edits (no entries are posted); a late edit into a locked period waits as a conflict for an admin, judged by server order. Erasure is a separate wipe path: a member erases their own personal data (entries touching shared accounts keep the author as a "deleted member"); the admin erases the whole family ledger with extra confirmation; cloud copies are deleted and keys destroyed. `verify_projection` rebuilds the projection from revisions and compares; it runs in backup verification and CI. The canonical serialization (deterministic CBOR) and revision hash are frozen before the first release.

## Alternatives Considered
### Pure event sourcing
- **Pros**: Elegant
- **Cons**: Rebuilding projections at 1M entries; weaker database guards
- **Why not**: Rejected

### State tables plus patch log
- **Pros**: Familiar
- **Cons**: Patches are fragile to merge and encrypt
- **Why not**: Rejected

### Triggers keep revisions and projection in step
- **Pros**: Declarative
- **Cons**: Hard to test; bypassed during sync apply
- **Why not**: Withdrawn after review


## Consequences
### Positive
- Undo, history and conflicts are the same mechanism.
- Sync ships exactly what is stored.

### Negative
- Two data shapes must stay consistent (the verification command guards this).
- Append-only conflicts with erasure; a separate wipe path is needed.

### Risks
- Revision storage grows forever; segments and snapshots keep it manageable.

## Implementation notes (story core-rebuild-2, 2026-10-13)
Found while building the store and in the independent Rust and silent-failure reviews:
- Revision bodies reference commodities and accounts by their global id, never by code, so a rename breaks no old revision.
- A local write must continue the current head of its document (`parent_id` equals the head, or `None` for a new document); otherwise the core returns `Conflict`. Revisions that arrive from sync enter through a separate import path that keeps their ids and may fork a document; `set_server_seq` re-projects because the head can change. Non-head leaves are listed as conflicts.
- All revisions of a document share one kind, and a parent belongs to the same document.
- The projection is writable only inside a projection session opened by the core. The gate stops faulty writers, not hostile ones. A line carried over unchanged from the previous head of its entry may sit on an archived account (an old entry can still be corrected); a changed or new line may not.
- Invariants are checked again by triggers when lines of a posted entry change, and by `verify_projection`, which also checks line numbering. `rebuild_projection` empties and replays the whole projection (commodities, accounts parents first, entries).
- A line uses the commodity of its account, and an account in use cannot change commodity; an account cannot become its own ancestor.
- The first migration was edited during this story because no release exists yet; the rule against editing an applied migration starts with the first release.
- Decision of 2026-10-16: the period lock date is not part of v1. The sentence about a period lock above stays as the later design; the settings document may gain an optional `lock_date` with one check point in `Ledger` when several members and reconciliation exist (backlog).
- Correction of 2026-10-17: only accounts have an archived state. The phrase "archived commodities" above is not implemented and not planned for v1: a commodity is never deleted, and to stop using one the user archives its accounts (ADR-0021).
