# ADR-0007: The admin grants who may change shared data

**Date**: 2026-10-13
**Status**: superseded by [ADR-0015](0015-per-account-roles.md)
**Deciders**: product owner

## Context
One ledger file serves a family. Until now any member could create, rename, archive or delete accounts, set exchange rates and edit the Rehber (contacts). Spec mining (`backend/specs/FINDINGS.md`, item 6) showed no role gate there. The owner decided the family admin must control who may do what; everyone keeps reading everything.

## Decision
Three grants per member: `accounts`, `rates` and `contacts` (columns `can_manage_*` on `actors`, default 0). An admin always holds all three and is the only one who can change them (trigger `admin_only`, audited in `audit_log`). Members still post, edit and delete their own entries without any grant. Writes to accounts, `fx_rates`, `contacts` and `brand_businesses` need the matching grant: the API checks first (`permission_denied`) and triggers enforce it. Reading stays open to every member. A new member starts with no grants.

## Alternatives Considered
### Admin-only, fixed
- **Pros**: simplest, no grant UI.
- **Cons**: a trusted partner cannot add an account or a contact.
- **Why not**: the owner wants the admin to decide per member.

### Per-member read restrictions or per-account visibility
- **Pros**: finer privacy.
- **Cons**: reports and balances depend on who looks; large design and test cost.
- **Why not**: the owner keeps "everyone reads everything" (accounting transparency).

### A roles table with arbitrary permissions
- **Pros**: extensible.
- **Cons**: premature for three switches.
- **Why not**: YAGNI; three columns are easy to migrate later.

## Consequences
### Positive
- The admin controls the shared structure; the rule holds in the database, not only the API.
- Grants are visible in `members.list` and audited.

### Negative
- Existing members of an older book lose these rights until the admin grants them (migration 0013 defaults to none).
- A member inside a Quick Entry flow cannot create a new Rehber contact without the `contacts` grant.

### Risks
- The triggers trust the `created_by`/`updated_by` the statement carries, and the API always stamps the real signed-in member. Raw SQL sent through the Tauri `db_query`/`db_batch` commands could name any actor, so "the database enforces it" holds against bugs and other code paths, not against a hostile webview. Closing that needs the Rust side to accept only named operations; it is an open item in the security notes.
- A removed member keeps no grants and, from migration 0014, no power in the triggers; an open session of a removed member is locked at the next call.
- Per-entry sharing and read limits are not covered; revisit this ADR if the owner wants them.
