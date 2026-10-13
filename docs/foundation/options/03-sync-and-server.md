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

Recommendation at first writing: S1. **Superseded by the section below after the price check.**

## Sizing guess (to measure later)
An encrypted revision is about 1 to 2 KB. A family with 50,000 entries is roughly 100 MB; a heavy one with 1,000,000 entries is 1 to 2 GB. Storage quotas per plan are a business decision.

## Risks
- A solo operator for a financial service: monitoring, backups tested by restore, an incident plan, abuse limits (per-family size and rate caps).
- The server sees metadata: family and document ids, sizes, arrival times, who writes. Content stays opaque.
- Protocol mistakes are expensive after release: freeze the envelope and the canonical serialization early and test them with a second implementation.

## Revision after the Cloudflare price check (owner round 14)
Sources: [Cloudflare plans page](https://www.cloudflare.com/plans/#developer-platform), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [data location](https://developers.cloudflare.com/durable-objects/reference/data-location/).

### Verified figures (October 2026 reading)
- Workers Paid has a 5 USD per month minimum. Durable Objects (SQLite-backed) include per month: 1 million requests, 400,000 GB-s duration, 25 billion rows read, 50 million rows written, 5 GB stored. Beyond that: 0.15 USD per million requests, 12.50 USD per million GB-s, 1.00 USD per million rows written, 0.20 USD per GB-month stored.
- Duration is billed on the 128 MB allocated to an object. WebSocket Hibernation removes the duration charge while idle; incoming WebSocket messages count 1 request per 20 messages; outgoing messages are free. Cloudflare's own example of 100 objects with 100 hibernating sockets each costs about 20.65 USD per month.
- R2 standard: 0.015 USD per GB-month, no egress fee, 4.50 USD per million write operations (class A), 0.36 USD per million reads (class B), 10 GB free.
- Durable Objects can be pinned to the `eu` jurisdiction; R2 buckets also support an EU jurisdiction. The jurisdiction is the EU, not Germany specifically; older notes say jurisdictions do not combine with user-chosen ids, so the family-to-object registry needs a design (not verified against current docs).

### Cost model (assumptions, not measurements)
Per active family: 1 object, 4 devices on hibernating sockets, 100 pushed revisions per day, 100 MB stored.
| Families | Requests, duration, rows | Storage if all in the object | Storage if old revisions move to R2 segments |
|---|---|---|---|
| 100 | inside the included allowance | 10 GB: about 1 USD | about 1 USD |
| 1,000 | inside the included allowance | 100 GB: about 19 USD, total about 24 USD | R2 about 1.5 USD plus batched writes: total about 8 to 10 USD |
One R2 write per revision would add about 13.50 USD per month at 1,000 families, so revisions are batched into segments. Conclusion: the 25 USD ceiling holds into the low thousands of families if old data lives in R2.

### Self-hosting reality
Running Workers and Durable Objects yourself is not ready: workerd's Durable Objects run in a single instance and are described as good for local testing; Deno's `celld` is alpha with no KV, R2 or Queues ([coverage](https://daily.dev/posts/celld-self-hosted-distributed-durable-objects-sxggesxkd)). So the self-host server is a second, small implementation (Rust + SQLite, Docker) written from the protocol and checked by the same conformance tests.

### Changed recommendation
- **Hosted service: Cloudflare (S2).** It removes the sysadmin burden for a solo operator, hibernating WebSockets give the instant updates the owner prefers, one Durable Object per family is the natural ordering point for "first writer wins", and cost is about 5 to 10 USD per month at the start. Region: `eu` jurisdiction.
- **Protocol first.** The written protocol and a conformance test suite are the product; the Cloudflare server and the later self-host binary are two implementations of it. This also satisfies the architect's advice to test the envelope with a second implementation.
- The server logic is small (authenticate, authorize by envelope, order, store, notify) and may be TypeScript on Workers; it never needs the Rust core because it cannot read content (envelope signatures use Ed25519, which WebCrypto provides).
- Tooling note: Cloudflare work uses the `cf` CLI unless the project has a Wrangler configuration file (owner's global rule).
- Cost of this choice: Cloudflare lock-in for the hosted side and two server implementations to maintain. The fixed-price VPS (S1) stays the fallback if Cloudflare pricing or terms turn bad.
