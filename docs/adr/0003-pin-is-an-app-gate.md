# ADR-0003: PIN is an app gate, not encryption

**Date**: 2026-10-13 (decision made with the PIN gate plan; see [pin-gate](../pin-gate.md))
**Status**: accepted
**Deciders**: product owner

## Context
One ledger file serves a family. Members should not act as each other, and a visitor at the open app should not see the books. The file itself is plain SQLite and anyone with file access can read it.

## Decision
Each member has a 6-digit PIN. The app locks on open and after 5 minutes idle. The session lives in memory inside the API; locked, only a short list of operations runs. The PIN is stored as a salted PBKDF2-SHA256 hash (200,000 iterations). Five wrong tries cause a 30-second wait stored in the file. The admin resets a forgotten PIN. The docs never call this security.

## Alternatives Considered
### Encrypt the file (SQLCipher)
- **Pros**: real protection at rest.
- **Cons**: key management, a lost password loses all data, build weight.
- **Why not**: deferred; decide before release (open item in the overview).

### No sign-in
- **Pros**: simplest.
- **Cons**: no member identity, so no roles or "own entries" rule.
- **Why not**: roles and the audit trail need an actor.

### Longer password
- **Pros**: stronger.
- **Cons**: friction for a quick family app.
- **Why not**: the gate is for convenience and separation, not for attackers.

## Consequences
### Positive
- Roles (`admin`, `member`) and per-member audit work.

### Negative
- A lone admin who forgets the PIN has no in-app recovery.
- A changed system clock can skip the wait (accepted).

### Risks
- 6 digits are brute-forceable offline from the hash. Real protection is OS accounts and disk encryption; keep saying so in the docs and `SECURITY.md`.
