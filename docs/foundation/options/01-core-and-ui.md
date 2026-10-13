---
owner: backend-engineer
status: draft
---

# Options 1: shared core language, desktop shell and UI

Inputs: [vision](../vision.md), [interview](../interview.md). Priority order: integrity, privacy and security, compatibility, resource use, performance. Claude Code writes and maintains everything. Figures marked *measure* are guesses to be replaced by a spike.

## What the core must do, once, for every platform
Ledger rules and scenarios engine, amount arithmetic, event log and revisions, backup and verification, E2EE key handling and encryption, sync client, plugin host (sandbox), report queries. The database triggers carry the last-guard accounting rules (portable, SQLite is everywhere). Anything that is not in a trigger lives in the core.

## Core language
| Option | For | Against |
|---|---|---|
| **Rust library** (recommended) | One implementation for desktop and later native mobile (UniFFI to Kotlin/Swift); strong types for money; memory safe; best crypto and WASM plugin hosting (wasmtime); small and fast | Slower compile cycles; the owner must trust tests and review rather than reading code |
| TypeScript (today) | Fast to write; shared with a web UI | Native mobile cannot reuse it without embedding a JS engine; weak for exact arithmetic and crypto hygiene |
| Kotlin Multiplatform | One core for Android, iOS, desktop | JVM weight on desktop; weaker WASM and crypto story; iOS interop young |
| Dart (Flutter) | One language for core and UI | Core tied to the UI framework; weaker for a sync/crypto library other apps may reuse |

## Desktop shell and UI
| Option | For | Against |
|---|---|---|
| **Tauri 2 + web UI** | Small installer; Rust core is native to it; the strongest UI ecosystem (shadcn/ReUI, tables, accessibility); AI writes web UI well; sandboxed plugin panels via iframes | OS web view differs (WebKitGTK on Linux is the weak spot); not truly native; *measure* idle RAM |
| Flutter (desktop + mobile) | Same pixels on every OS; one UI code base for desktop and mobile; Rust core via flutter_rust_bridge | Not native widgets; weaker accessibility and text handling; plugin UI hard to sandbox; new language |
| Compose Multiplatform | One UI for desktop, Android, iOS | JVM memory; young on iOS; heavy |
| Native per OS | Best feel | Three or four UI code bases: not maintainable for one AI maintainer |
| Rust UI (Slint, Iced, egui) | Tiny and fast | Thin ecosystem for complex data grids and accessibility; polish risk against the "perfect UX" goal |
| Electron | Identical everywhere (Obsidian does this) | Heaviest; breaks the low-resource priority |

## Recommendation
Rust core. Desktop v1 on Tauri 2 with a web UI (framework still free: React is the default, nothing forces ReUI). Mobile later: native Kotlin/Swift UIs on the same Rust core through UniFFI, as the owner planned.

## Spike (before the ADR)
Build the same two screens in Tauri + web UI and in Flutter, both on a Rust core with a 1,000,000-entry SQLite file: a virtualized journal list and a Quick Entry dialog with Turkish text input. Measure on Windows, macOS (CI runner) and Linux: cold start, idle and loaded RAM, scroll smoothness, installer size, keyboard and screen-reader behavior. Decide from numbers, not taste.

## Risks to keep in view
- A web view cannot be fully replaced on Linux; if WebKitGTK fails the spike, Flutter becomes the lead.
- Rust slows the first months; the gain is one core for four platforms and a safe plugin host.
- The owner cannot test macOS locally (WSL2 dev machine); a CI matrix is required.
