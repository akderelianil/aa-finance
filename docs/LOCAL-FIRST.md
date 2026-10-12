---
owner: main
status: active
---

# Local-first direction

Decided 2026-10-12 with the product owner. Replaces the Supabase backend for v1. Phases are in [ROADMAP](ROADMAP.md).

## Goals
- Privacy: data stays on the user's device. No server can read it.
- Cost to the user: minimum RAM and CPU. The app starts fast and does not stall.
- No network wait: every read and write is local.

## Stack
- Shell: Tauri 2, desktop only in v1.
- Logic: TypeScript package with no UI dependency (schema, posting, validation, reports).
- Data: one SQLite file on disk (WAL mode). DuckDB is not used; measure first.
- UI: the existing React + ReUI code, with the Supabase data layer replaced by a local repository.

## Rules
- The core package must not import UI or Tauri code. A phone UI can reuse it later.
- Balance rules stay in two places: a SQLite trigger and the posting service.
- Balances are derived from lines. Do not store them.
- Primary keys are UUIDv7. Entries are versioned and not overwritten. Delete is a reversal or a soft delete. This keeps sync possible later.
- Local profile: a user name only. No server auth in v1.
- Money stays int64 minor units. Rates and quantities are text.

## Budgets (measure each phase)
- Cold start under 1 s on a desktop.
- Idle RAM under 150 MB.
- First bundle under 500 KB compressed.
- Reports on 1M synthetic lines under 200 ms.

## Out of v1
- Sync, groups, member access, mobile, server-side FX fetch.
- Later: encrypted sync. The server technology is not chosen. The server stores ciphertext only. Entry-level versions with a hybrid logical clock settle conflicts. Key loss means data loss, so a recovery key is required.

## Open decisions
- Encrypt the SQLite file at rest (SQLCipher) in v1 or later.
- How the local profile maps to the group and member model that exists today.
- FX rates in v1: manual entry only, or a public rate fetched by the client.
