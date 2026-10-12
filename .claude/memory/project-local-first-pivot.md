---
name: project-local-first-pivot
description: 2026-10-12 decision to move v1 from Supabase to Tauri + local SQLite + TS core; sync/E2EE later
metadata:
  node_type: memory
  type: project
  originSessionId: 65aee460-9522-404c-8783-aca9f19cf8c3
  modified: 2026-10-12T10:55:30.130Z
---

Decided 2026-10-12: v1 is a desktop Tauri 2 app with a local SQLite file and a UI-free TypeScript core. Privacy and low RAM/CPU are the goals. Local profile only, no server auth. Plan: docs/LOCAL-FIRST.md, phases L0–L4 in ROADMAP.

**Why:** the user wants trust through local data, a fast start, and no stalls on desktop and phone. Server-side logic cannot work with data the server must not read.

**How to apply:** keep the core free of UI/Tauri imports. Use UUIDv7, versioned entries and derived balances so encrypted sync (PocketBase relay, HLC, recovery key) and mobile can follow. Do not add DuckDB; measure SQLite first. Supabase code stays until L4 is done. Open: SQLCipher at rest, group/member model in v1, FX rates source. See [[project-ledger-core-pivot]].
