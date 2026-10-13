# ADR-0015: Per-account roles replace "everyone reads everything"

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: Supersedes [ADR-0007](0007-admin-grants-for-shared-data.md).

## Context
Families of up to 10 adults and children need private accounts. The old rule that everyone reads everything and an admin grants edit areas no longer fits.

## Decision
A permission is member x account x action (see, post, edit, manage). A member sees only their own accounts by default; the admin sees every account and none can be hidden from the admin. An entry is visible in full, with every account label, to anyone who can see at least one of its accounts; there is no "hidden account" mask. Editing an entry is allowed to its author, to the admin, and to holders of the edit right on the accounts involved. Family-wide documents (settings, commodities, prices, contacts, membership) are visible to all members. Reports for a restricted member cover the accounts they can see and do not give a balanced family trial balance. A revoke affects future revisions only. A member who leaves may export their own data in any format; the family keeps the shared records. The command line uses a local token bound to a member and that member's permissions. The device PIN remains a gate for the app, not encryption; on a shared computer there is no real separation and the UI says so. Write rights are enforced by honest clients; the cryptography enforces reads only.

## Alternatives Considered
### Admin-only grants (ADR-0007)
- **Pros**: Simple
- **Cons**: Cannot express private accounts
- **Why not**: Superseded

### Per-entry visibility
- **Pros**: Fine grained
- **Cons**: Breaks accounting views and key design
- **Why not**: Rejected; account-based is enough


## Consequences
### Positive
- Clear mapping from accounts to keys.
- Private accounts for adults inside a family.

### Negative
- Restricted members cannot see a balanced family view.

### Risks
- A malicious modified client of a member with write access could misuse it; documented.
