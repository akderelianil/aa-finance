# ADR-0014: Account separate from keys; per-account keys; signed membership log; recovery

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: Supersedes the security claims of [ADR-0003](0003-pin-is-an-app-gate.md); the PIN stays a device gate.

## Context
Sync must be end-to-end encrypted with per-account roles, recovery after device loss, and no trusted server. Independent threat modelling ranked tampered updates, injected code, enrollment substitution, compromised admin devices, log rollback and recovery-key mishandling first.

## Decision
An account (who you are to the service) never holds a key; keys are made on devices. Device keys (Ed25519 and X25519) live in the OS keystore, and every request is signed with a nonce and timestamp. Member keys are wrapped to each device and to a recovery key (256 random bits, 24 words, retyped at set-up, HKDF-derived, never on the clipboard or in logs, verified locally). Each ledger account has its own symmetric key (XChaCha20-Poly1305), wrapped to every member who may see the account and to every admin; family-wide documents use a family key. Each revision gets a fresh data key, wrapped under the key of each touched account. Membership, grants, removals, device registrations and key wraps are signed, hash-chained revisions; clients wrap keys only for members and devices in the verified log. Joining a family or becoming an admin requires an out-of-band check (QR or short code), the invite is bound to the invitee's public key, and a new device of a member needs approval from an existing device; the emailed one-time code alone grants no keys. Signatures cover family, document, parent, reader-set, wrapped keys, algorithm, protocol version and ciphertext hash, with domain separation; the encoding is deterministic CBOR; AEAD associated data binds family, document and revision ids; clients enforce a minimum set of algorithms. Freshness: signed monotonic sequence numbers, signed per-family checkpoints, clients remember the last head and refuse regressions. Account keys have epochs; only an admin rotates; writes under an old epoch are rejected by log position. Admin recovery of a member, recovery-key use, and admin promotion are logged and shown to every member; with two admins, admin-granting actions need a second signature, and the app recommends two admins strongly. A newly granted member sees the account's history. First registration on the hosted service uses an emailed one-time code; a self-hosted deployment creates its first admin with a deployment secret. Passkeys and Apple/Google sign-in come later. Backups may use an optional passphrase (Argon2id), chosen by the user. Primitives sit behind algorithm ids: Ed25519, X25519, XChaCha20-Poly1305, HKDF-SHA256, BLAKE2 or SHA-256, HPKE (RFC 9180), vetted Rust crates.

## Alternatives Considered
### Account key held by Google or Apple
- **Pros**: Easy recovery
- **Cons**: The provider could decrypt
- **Why not**: Not end-to-end encryption

### Password-derived master key
- **Pros**: Familiar
- **Cons**: Forgotten passwords lose data; weak passwords
- **Why not**: A random key plus a recovery key is safer

### One key per reader set
- **Pros**: Fewer keys
- **Cons**: Grants and revokes rewrite history
- **Why not**: Per-account keys match account roles


## Consequences
### Positive
- A grant is one wrap and opens the whole history; an admin can restore a member who lost everything.
- The server cannot add members or read content.

### Negative
- Losing every device and the recovery key of the only admin loses the cloud copy (accepted).
- Write rights are enforced by clients, not cryptography.

### Risks
- Metadata the server sees: ids, sizes, times, who writes, and which account ids a revision is wrapped for.
- A compromised admin device exposes every account; two admins and visible recovery limit the damage.
- Key transparency and head gossip are untested at family scale.
