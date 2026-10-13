---
owner: backend-engineer
status: draft
---

# Options 6: notifications while the app is closed

Owner: backlog, not v1, but "very important" for the architecture. A due date must reach the user even when the app is closed. Reminders come from **plan items** (instalments, card statement and due dates, bills, loans, salary days), never from ledger entries. No cloud is needed for local reminders; a push service is needed only for mobile and for sync events.

## What the platforms require (research)
- **Windows.** An unpackaged desktop app must have a Start menu shortcut carrying an AppUserModelID, and desktop apps cannot schedule a toast ahead of time, so a background process has to be running to fire it ([Microsoft guide](https://learn.microsoft.com/en-us/windows/apps/design/shell/tiles-and-notifications/send-local-toast-desktop-cpp-wrl)).
- **macOS.** `UNUserNotificationCenter` grants permission only to a bundled and signed app; an unbundled binary falls back to a script hack; an Apple engineer states User Notifications is not daemon-safe, so the helper has to be a proper app bundle in the user's session ([Bitcoin Core migration note](https://mirror.b10c.me/bitcoin-core-gui/112/), [Apple forum thread](https://developer.apple.com/forums/thread/728836)). Signing needs are a second reason for the signing gate.
- **Linux.** A systemd user timer that runs `notify-send` is enough ([example](https://dev.to/yawaramin/how-to-set-up-a-20-minute-computer-break-on-linux-2kna)); desktops without systemd need an autostart entry.
- **Mobile (later).** Local notifications are scheduled with the operating system (iOS has a pending-notification cap; Android needs exact-alarm permission); server push (APNs, FCM) wakes the app for sync.

## Options
| Option | For | Against |
|---|---|---|
| **N1. A tiny reminder helper** (a small Rust program from the core, started at login as a login item, launch agent or user service) (recommended) | Always on at a few megabytes of RAM; reads plan items from the local database read-only; works offline | One helper per operating system and a consent step at install; on macOS it must be a signed app bundle |
| N2. Keep the Electron app alive in the tray | One code path | 150 to 400 MB resident all day; breaks the low-resource priority |
| N3. OS schedulers only (Task Scheduler, launchd, systemd timers) | No resident process | Three schedulers to configure; Windows cannot schedule toasts |

## Design (N1)
- The helper wakes at the next due time computed from plan items, shows an OS notification, and opens the app on click. No network.
- Notifications are per member: a device is bound to a signed-in member; the helper shows only what that member may read. On a shared computer the notification text is minimal by default ("A payment is due today"); amounts and names are an opt-in setting.
- Every reminder is a plan item with a lead time rule (for example, 3 days and 1 day before). Snooze and "paid" mark the item; paying creates a real entry through the normal flow.
- Quiet hours, per-category switches, and a daily summary come later.
- Sync events do not need notifications on desktop (the open app updates live).

## Open questions
1. A login-time helper (N1) with an explicit consent step: accepted?
2. Default text minimal, amounts opt-in: accepted?
3. First notification release covers due plan items only (instalments, card due dates, bills); summaries later: accepted?
4. On macOS, notifications arrive only after the app is signed (consistent with the signing gate): accepted?
