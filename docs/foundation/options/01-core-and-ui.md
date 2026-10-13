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

## Desktop shell and UI (revised after owner round 10 and web research)
New constraints from the owner: the look must be identical on every OS; accessibility is mandatory; no spike, decide from published evidence; recent OS versions only; no local test machines (GitHub Actions matrix).

Evidence quality is low: most benchmark pages are SEO blogs with no method. Treat figures as direction, not fact.

| Option | Identical look | Accessibility | Linux | Weight | Verdict |
|---|---|---|---|---|---|
| Tauri 2, OS web view | No: three engines (WebView2, WKWebView, WebKitGTK) | Good (web) | Weak: Tauri's own guide lists driver clashes (NVIDIA, DMABUF); issues report slow frames and blank windows on WebKitGTK | Smallest (blog figures: ~40 to 170 MB RAM) | Fails the look and Linux requirements |
| **Electron** | Yes: bundled Chromium | Best: Chromium's full UIA, NSAccessibility, AT-SPI support and mature web tooling | Good | Heaviest (blog figures: ~170 to 400 MB RAM, large installer) | Meets every requirement; pays in RAM and size. Obsidian proves the model |
| Tauri + CEF (bundled Chromium) | Yes | Good | Good | Like Electron | Pre-release (alphas, API gaps, incomplete platform targets). Revisit later; the shell must stay replaceable |
| Flutter | Yes (own renderer) | Works through a semantics tree; docs list Narrator, NVDA, VoiceOver, Orca; one critic reports Linux gaps | Fine | Medium (blog figures ~45 to 90 MB, unverified) | Real contender; one code base for desktop and mobile. Weaker on accessibility confidence, data-grid ecosystem, Dart |
| Compose Multiplatform, Avalonia, Qt | Mostly | Unverified / Qt strong | OK | JVM or .NET weight, Qt licensing | No clear gain over the two above for an AI-maintained web-fluent stack |
| Slint, Iced, Dioxus, egui | Yes | Immature (AccessKit pre-1.0) | OK | Tiny | Fails mandatory accessibility today |
| Native per OS | No | Best | | | Not maintainable |

## Recommendation (revised)
- **Core: Rust** (accepted).
- **UI: web technology**, accessibility first (accessible primitives, keyboard first, tested with axe and screen readers in CI). React is the default; the owner has no attachment to ReUI.
- **Shell: Chromium-based for an identical look.** Electron today; Tauri + CEF when it leaves alpha. Keep the shell thin: the UI talks to the Rust core only through named operations over one IPC boundary, so the shell can be swapped.
- **Mobile later:** see the question in the interview (web UI in a thin native shell versus native screens).
- Performance of 1,000,000 entries is decided by SQLite indexes and paging, not by the UI toolkit; enforce it with performance budgets in CI.

## No spike, but budgets
Instead of a bake-off, the first vertical slice ships with measured budgets on the GitHub Actions matrix (Windows, macOS, Ubuntu): cold start, idle RAM, journal scroll at 1M entries, installer size. If a budget fails, revisit the shell, not the architecture.

## Risks to keep in view
- RAM and installer size are the price of Chromium. The owner ranked resource use fourth, below compatibility.
- Electron needs hardening (context isolation, sandbox, strict IPC), code signing and an update channel.
- No local macOS or Windows machine: all platform testing runs in CI.
