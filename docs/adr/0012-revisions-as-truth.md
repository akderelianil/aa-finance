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
