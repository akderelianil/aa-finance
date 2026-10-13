# ADR-0019: Licenses, contributions and privacy defaults

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: New decision.

## Context
The owner chose open source deliberately, with a paid sync service, and wants a trusting community.

## Decision
Clients and the core are MIT. The sync server is AGPL (self-hosting is supported, on the user's own Cloudflare account). Contributions are accepted under the Developer Certificate of Origin (a sign-off line); there is no CLA, and the project does not reserve a right to relicense. There is no telemetry by default; crash reports only on opt-in, shown before sending, never containing financial content. The user may export everything (documented schema plus CSV files) and restore from a separate full backup, and may erase their data. The app is for personal use, with no age limit and no child-specific mode.

## Alternatives Considered
### CLA
- **Pros**: Keeps a relicensing option
- **Cons**: Contributors dislike it
- **Why not**: Not wanted

### MIT for the server too
- **Pros**: Simplest
- **Cons**: Anyone could host a closed paid copy
- **Why not**: AGPL protects the paid service

### Default telemetry
- **Pros**: Product data
- **Cons**: Privacy promise
- **Why not**: Rejected


## Consequences
### Positive
- Low friction for contributors; a clear privacy promise.

### Negative
- No relicensing without every contributor.

### Risks
- A permissive client license lets others fork the client; the sync service and brand are the moat.
