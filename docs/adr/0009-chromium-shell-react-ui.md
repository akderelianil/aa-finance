# ADR-0009: Chromium-based shell with a React UI; native mobile screens later

**Date**: 2026-10-13
**Status**: accepted
**Deciders**: product owner, in the epic foundation-reset interview ([interview](../foundation/interview.md)); options and independent reviews in [foundation/options](../foundation/options/)

**Relation**: Supersedes the Tauri part of [ADR-0001](0001-local-first-sqlite-thin-rust.md).

## Context
The owner requires an identical look on every operating system, mandatory accessibility, no old systems, and problem-free Linux. Resource use ranks fourth, below compatibility. Evidence: Tauri uses three different OS web engines; its own guide lists graphics-driver clashes on Linux; reports show slow frames on WebKitGTK ([Tauri Linux guide](https://v2.tauri.app/develop/debug/linux-graphics/)). Flutter and Rust GUI toolkits have weaker accessibility confidence; Tauri with a bundled Chromium (CEF) is still alpha ([cef-rs](https://github.com/tauri-apps/cef-rs)).

## Decision
The desktop shell is Electron (bundled Chromium). The UI is React with accessible primitives; ReUI (shadcn on Base UI) is used where it fits. The UI imports no Electron API (a lint boundary) and talks to the core only through the named operations over one IPC boundary, so the shell can be swapped for Tauri+CEF later. Electron is hardened: context isolation, sandbox, no Node in the renderer, strict CSP, no remote content, navigation and `window.open` denied, permissions denied, a minimal preload, every IPC message validated; private keys never enter the renderer. Mobile apps come after the desktop, with native screens (Swift, Kotlin) designed for quick entry and glance, on the same core. Supported systems: Windows 10 22H2 and 11, macOS 13+, Ubuntu 22.04+ and equivalents.

## Alternatives Considered
### Tauri with the OS web view
- **Pros**: Smallest footprint
- **Cons**: Different engines per OS; weak Linux
- **Why not**: Fails the look and Linux requirements

### Flutter
- **Pros**: Same pixels, one code base with mobile
- **Cons**: Weaker accessibility confidence and grid ecosystem; plugin UI hard to sandbox
- **Why not**: Second place

### Compose Multiplatform, Avalonia, Qt
- **Pros**: Cross-platform
- **Cons**: JVM or .NET weight, licensing, unverified accessibility
- **Why not**: No clear gain

### Slint, Iced, Dioxus
- **Pros**: Tiny
- **Cons**: Accessibility immature
- **Why not**: Fails a mandatory requirement

### Native per OS
- **Pros**: Best feel
- **Cons**: Three or four UI code bases
- **Why not**: Not maintainable


## Consequences
### Positive
- Identical rendering and the best accessibility tooling.
- The largest UI ecosystem and strong AI support.

### Negative
- Higher RAM and installer size (accepted by the owner).
- Electron hardening, updates and Chromium patches are our job.

### Risks
- Unsigned installers and updates are the top threat (ADR-0018 holds the gate).
