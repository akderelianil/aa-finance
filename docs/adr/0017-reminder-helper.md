# ADR-0017: A tiny reminder helper for notifications while the app is closed

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: New decision.

## Context
Due dates must reach the user even when the app is closed. Windows cannot schedule toasts for unpackaged apps, macOS needs a signed app bundle for notifications, Linux can use a user service.

## Decision
A small Rust helper from the core starts at login after explicit consent (a login item, launch agent or user service). It reads plan items from the local database read-only and shows an OS notification at each due time and lead time; a click opens the app. It uses no network. Text is minimal by default and amounts and names are opt-in. The first notification release covers due plan items (instalments, card statement and due dates, bills); summaries and quiet hours come later. On macOS the helper is a signed app bundle, so notifications there wait for signing. Notifications are a backlog release, not v1.

## Alternatives Considered
### Keep Electron in the tray
- **Pros**: One code path
- **Cons**: 150 to 400 MB resident
- **Why not**: Breaks the resource priority

### OS schedulers only
- **Pros**: No resident process
- **Cons**: Three schedulers; Windows cannot schedule toasts
- **Why not**: Rejected


## Consequences
### Positive
- A few megabytes of memory; works offline.

### Negative
- One helper and installer step per operating system.

### Risks
- Notification text on a shared computer can reveal information; minimal by default.
