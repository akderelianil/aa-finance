---
owner: backend-engineer
status: draft
---

# Options 4: identity, keys, recovery and access control

Inputs: [options 2](02-amounts-and-data-model.md), [options 3](03-sync-and-server.md), [vision](../vision.md), interview rounds 1 to 15. Goal: the sync server cannot read content; per-account roles hold across devices; losing a device does not lose data; the owner's rules stand (the admin sees every account, a revoke affects future records only, a recovery key is mandatory, no account is hidden from the admin).

## Two separate things
- **Account (who you are to the service).** Lets a person register devices, join a family, be billed. It never holds an encryption key.
- **Keys (who can open the data).** Created on devices. The server only stores wrapped (encrypted) keys.

## Key hierarchy (proposed)
1. **Device keys.** Each device makes a signing pair (Ed25519) and an agreement pair (X25519). Private halves stay in the OS keystore (Windows Credential Manager/DPAPI, macOS Keychain, Linux Secret Service; a passphrase-protected file as the Linux fallback). Every request to the server is signed by the device.
2. **Member keys.** Each member has a signing pair and an agreement pair. The private halves are wrapped to each of the member's devices and to the recovery key.
3. **Recovery key.** 256 random bits shown as 24 words at set-up; the user must retype it to continue. It unwraps the member keys on a new device after total loss.
4. **Account keys, one per account.** A symmetric key (XChaCha20-Poly1305) for each ledger account, wrapped to every member who may see that account, and always to every admin.
5. **Family key.** One shared key for family-wide documents (settings, commodities, prices, contacts, the membership log).
6. **Revision encryption.** Every revision gets a fresh random data key. The revision is encrypted with it; the data key is wrapped once under the key of each account the entry touches (and under the family key for family documents). A member opens an entry if they hold the key of at least one touched account, which matches the owner's rule "anyone who sees one account of an entry sees the whole entry".

Why per-account keys: a **grant** is one wrap of one account key to the new member, and the whole history of the account opens at once; a **revoke** rotates that account's key for new revisions only (old data stays readable by someone who already held the key, as the owner accepted). Entries that touch several accounts carry several wraps, at most one per line.

## Membership is a signed log
Invites, grants, removals, device registrations and key wraps are revisions of the family document, signed by an admin (or by the member for own devices) and chained by hash. The server stores them but cannot forge an admin signature, so it cannot slip in a fake member. Clients wrap keys only for members and devices listed in the verified log. An invite carries a one-time secret and the inviter's key fingerprint; an optional short safety code lets two people compare fingerprints.

## Recovery paths
| Case | Outcome |
|---|---|
| Lost one device | Another device or the recovery key registers a new one; the old device is revoked |
| Lost all devices, has recovery key | The recovery key restores the member keys; everything opens |
| Lost all devices and the recovery key | An admin issues new wraps to the member's new identity. Nothing is lost because the admin already holds every account key |
| The only admin loses all devices and the recovery key | The cloud copy cannot be opened (the owner accepted this); local copies on other devices remain. The app warns while a family has one admin and encourages two |
| Forgotten device PIN | Admin reset, as in the old design; the PIN is a device gate and holds no keys |

## Sign-in to the hosted service
Passkeys inside Electron are unreliable (platform authenticators are not fully supported there; not verified in this session). Proposal: an emailed one-time code registers the first device of a person; after that each device authenticates by signing requests with its device key. Apple and Google sign-in are later conveniences (identity only). A self-hosted deployment has no email service: the first admin is created with a deployment secret, and members join through invite links.

## Local data
The owner decided against encrypting the local database. Keys live in the OS keystore only for sync. Backups are plain database copies unless the user turns on an optional backup passphrase (proposed, off by default).

## Algorithms and agility
XChaCha20-Poly1305, Ed25519, X25519, HKDF-SHA256, BLAKE2 or SHA-256, HPKE (RFC 9180) for wrapping, audited Rust crates (RustCrypto or libsodium). Every envelope carries an algorithm id so primitives can change later without a new format.

## Known limits (stated to users)
- A revoked member keeps what already reached their device.
- A lost device cannot be wiped remotely; it can only be cut off from sync. The device PIN is not encryption.
- The server sees metadata: ids, sizes, times, who writes, which account ids a revision is wrapped for.
- A compromised member device exposes every account that member could read; the response is to rotate those account keys.
- A malicious plugin with API access can read what the user can read; the sandbox and permission manifest are the defence (topic 5).

## Open questions
1. Admin as key holder for every account: accepted by the owner's rule; confirm that the app should push families to have two admins.
2. Should a newly granted member see the account's past entries? (Proposed: yes.)
3. Optional encrypted backups with a passphrase: offer?
4. Email one-time code for first registration: acceptable for the hosted service?
