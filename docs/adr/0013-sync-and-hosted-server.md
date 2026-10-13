# ADR-0013: Sync protocol first; hosted server on Cloudflare; self-hosting on the user's own Cloudflare account

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: New decision.

## Context
Paid sync is the business model. It must be end-to-end encrypted, offline-first, instant, cheap (about 25 USD per month at the start), run by one person, and self-hostable (AGPL). The free tier uses no server.

## Decision
A written protocol and a conformance test suite are the product. The server keeps, per family, an append-only log of encrypted revisions with a plaintext envelope (family, document, revision, parent, reader-set, author, device, signature, size, versions) and cannot read content. It orders by `server_seq` (first accepted wins; later siblings become conflict branches), checks that the author may write to the reader set, serves `changes since seq`, stores encrypted snapshots, and pushes updates over hibernating WebSockets. Hosting: Cloudflare Workers with one SQLite-backed Durable Object per family in the `eu` jurisdiction for ordering, and R2 for old revision segments, snapshots and later attachments; the server is TypeScript. Self-hosters deploy the same code to their own Cloudflare account (one command or button); there is no VPS or Docker server, and the client has a per-family pinned "server address" setting. Priced reading (October 2026): Workers Paid 5 USD per month minimum with generous Durable Object allowances; R2 0.015 USD per GB-month ([pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)); the estimate stays near 5 to 10 USD per month into the low thousands of families if old data lives in R2. Outage tolerance: hours; clients keep working offline. A live database inside a cloud-synced folder is refused unless the user overrides; backups may go there. The free tier never contacts a server.

## Alternatives Considered
### Rust binary with SQLite and Litestream on a VPS
- **Pros**: Self-hostable anywhere; fixed price
- **Cons**: The owner runs a Linux box; a second code path for Cloudflare is not needed but ops is
- **Why not**: Fallback if Cloudflare terms or price turn bad

### Docker server for self-hosters plus Cloudflare for hosted
- **Pros**: Self-host anywhere
- **Cons**: Two implementations to maintain
- **Why not**: Owner chose to send self-hosters to Cloudflare

### Postgres service
- **Pros**: Familiar
- **Cons**: More to run
- **Why not**: No gain


## Consequences
### Positive
- Minimal operations for a solo operator.
- Instant updates and a natural ordering point.

### Negative
- Lock-in to Cloudflare for the hosted service and for self-hosters (stated openly).
- A solo-run financial service needs monitoring, restore drills and abuse limits.

### Risks
- Durable Object jurisdiction and user-chosen ids: check the current documentation when designing the family registry.
- Self-host Durable Objects outside Cloudflare are not ready (workerd single instance, celld alpha).
