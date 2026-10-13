---
owner: backend-engineer
status: draft
---

# Options 3: sync protocol and server

Inputs: [vision](../vision.md), [options 2](02-amounts-and-data-model.md), the interview. Needs: end-to-end encrypted (the server cannot read content), offline first, first writer wins and the loser is kept, family of up to 10, several devices, a solo operator, about 25 USD per month, AGPL and self-hostable, mobile clients later. Free tier uses no server.

## Protocol shape (recommended)
- **Log of encrypted revisions.** The server keeps, per family, an append-only list of revisions in the order it accepted them (`server_seq`). Content is ciphertext. A small plaintext envelope lets the server do its job: family id, document id, revision id, parent revision id, reader-set id (which key group can open it), author member and device, a signature, size, `protocol_version`.
- **Push and pull.** The client pushes revisions in batches (idempotent by revision id) and pulls `changes since seq`. A WebSocket or server-sent event nudges other devices; a periodic pull is the fallback.
- **Conflict rule.** For a document, children of the same parent are ordered by `server_seq`; the earliest becomes the head, the later ones are conflict branches. Clients compute this deterministically, show conflicts, and a merge is a new revision with both parents. The server never merges (it cannot read).
- **Authorization without reading.** The server checks the envelope: is the author a current member with write rights to that reader set? It cannot check the content. Clients verify the signature and the rules again on receipt; a revision that fails becomes "needs attention", never dropped (see options 2).
- **Membership and grants** are signed revisions of a family-settings document; keys are wrapped per reader (topic 4).
- **Snapshots.** A device may upload an encrypted snapshot so a new device does not replay millions of revisions. Attachments (later) are encrypted blobs addressed by hash.
- **Versions.** Every envelope carries protocol, schema and core versions; an old client refuses a newer family file instead of corrupting it.
- Precedents for the pattern (ciphertext server, conflict resolution on the device): Anytype's open Any-Sync protocol ([Any-Sync](https://pkg.go.dev/github.com/anyproto/any-sync@v0.4.9)); 1Password versions every item and resolves conflicts on the device (secondhand [community answer](https://www.1password.community/1password-at-home-31/how-1password-resolve-edit-conflict-without-sending-unencrypted-data-to-server-22190)).

## Server options
| Option | For | Against |
|---|---|---|
| **S1. One Rust binary + SQLite, replicated with Litestream to object storage, on a small VPS** (recommended) | Same server for the hosted service and for self-hosters (AGPL, Docker image); very cheap; SQLite is plenty for thousands of families; Litestream is maintained and replicates to S3-compatible stores including R2 ([overview](https://jacar.es/en/litestream-near-real-time-replication-for-sqlite/)) | You run a Linux box: updates, monitoring, incident response; one node means downtime when it fails (clients keep working offline, so an outage is delay, not loss); price of the VPS varies (about 4 to 8 EUR per month in 2026 sources; check Hetzner's page) |
| S2. Cloudflare Workers + SQLite-backed Durable Objects (one per family) + R2 | Managed; per-family serialization is natural; scales to zero | Cloudflare-only: a self-hoster cannot run it, so a second server must exist; SQLite storage billing started January 2026 ([changelog](https://developers.cloudflare.com/changelog/2026-01-07-durable-objects-sqlite-storage-billing)); I could not confirm the current price figures; 10 GB per object limit |
| S3. Postgres-based service | Familiar | More to run; no gain at this size |

Recommendation: S1 as the one server, with R2 or Backblaze for Litestream backups and later for attachments. If operations become the pain point, a managed host for the same binary is a smaller step than a second implementation.

## Sizing guess (to measure later)
An encrypted revision is about 1 to 2 KB. A family with 50,000 entries is roughly 100 MB; a heavy one with 1,000,000 entries is 1 to 2 GB. Storage quotas per plan are a business decision.

## Risks
- A solo operator for a financial service: monitoring, backups tested by restore, an incident plan, abuse limits (per-family size and rate caps).
- The server sees metadata: family and document ids, sizes, arrival times, who writes. Content stays opaque.
- Protocol mistakes are expensive after release: freeze the envelope and the canonical serialization early and test them with a second implementation.
