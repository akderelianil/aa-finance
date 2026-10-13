---
owner: product-lead
status: active
---

# Roadmap

Goal: a GnuCash-style double-entry core for professional personal-finance users. Local-first desktop app. Judge every item against the ledger core ([ARCHITECTURE](ARCHITECTURE.md)).

## Done
| Phase | Content |
|---|---|
| Ledger core (Oct 2026, Supabase) | Chart of Accounts, General Journal, Account Register, reports, Quick Entry, simple chart, ReUI. Retired in `archive/`; tag `supabase-final`. |
| L0–L2 | Tauri shell, SQLite schema with triggers, core API with tests. See [local-first](backend/architecture/overview.md). |
| L3 | UI on ReUI: Chart of Accounts, Journal and editor with history, Register, Reports, Quick Entry, Settings, Exchange Rates. |
| L4 | Backup (manual, daily automatic, restore), Activity page, benchmark. |
| X1 Setup and members | First-run setup in 6 keyboard steps ([kurulum](product-designer/ux/kurulum.md)), members with roles, sidebar member menu. |
| X1e Roles and format | Country sets date and number format. Journal shows the writer; a member sees Edit and Delete only on own entries. Book settings admin only (migration `0004`). |

## Now (X1 user flows)
Review the flows one at a time with the product owner; focus is UX/UI. Order: setup (done), entry, edit, find, report.
- Done: member PIN gate (lock on open and on idle). Plan: [pin-gate](pin-gate.md). Open: drafts per member across member switch (see ux/pin.md, "Uygulanmadı / sapma").
- Next: entry flow (Hızlı Kayıt). The owner narrates how they use it today, then critique and options.
- Click through setup, members, backup and restore in the real Tauri app ([DEVELOPMENT](DEVELOPMENT.md#run-the-real-app)).

## Later
- **Audit trail (future plan).** Today `audit_log` stays in the SQLite file: written by triggers, immutable, kept forever, shown as entry history. Next: a per-member audit view, export of the audit log with the backup, and tamper evidence (hash chain) before sync starts.
- Rebuild convenience flows on `entries.post`, one UX scenario at a time (loan, installment, deposit, investment).
- Num, reconcile, scheduled entries, FX revaluation, contact links on Gider and Gelir lines, an open-balance column in the Rehber, tags, dashboard.
- Plugins (trusted, restricted mode by default), sync, encryption at rest (decide before release).

Each phase ends with: tests, `npx tsc --noEmit`, `npm run lint`, a browser check of the changed screen, one commit.
