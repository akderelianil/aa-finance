---
owner: product-lead
status: legacy (prototype; replaced by epic foundation-reset)
---

# PIN gate

Directive: every member has a 6-digit PIN that opens a session. Small and effortless. This reverses the product rule "No PIN or sign-in".

Ledger-core link: none directly. It protects access to the core. Judged as a small gate, not a security feature.

## Honest scope
- The SQLite file is **not encrypted**. Anyone who can read the file can read every entry, and can delete the PIN rows with any SQLite tool.
- The PIN is an **app gate**: it stops a family member or a visitor who uses the open app. It is not protection against file access. Real protection is OS accounts and disk encryption (encryption at rest stays in [Later](ROADMAP.md#later)).
- The PIN is stored as a salted slow hash (PBKDF2-SHA256 through WebCrypto), never plain. 6 digits = 1,000,000 values, so the hash is brute-forceable offline. Say this in the docs; do not call it security.
- The UI and the API share one process. The API gate binds the actor only after a PIN check, so no screen can act as a member by calling `setMember`.

## Decisions (owner)
| # | Decision |
|---|---|
| 1 | Lock on app open and on idle. On open: pick member, enter PIN. Switching member = lock, then pick and PIN again. |
| 2 | Forgotten PIN: the admin resets a member's PIN; the member sets a new one at next sign-in. A lone admin who forgets has no recovery in the app. |
| 3 | 5 wrong tries → 30 s wait. No permanent lock. |

## Decisions (product-lead, change if you disagree)
| Topic | Choice | Why |
|---|---|---|
| Idle time | Constant 5 minutes, no input | A setting needs a migration (the `settings` table has a CHECK per key) and a Settings control. Smallest scope first; promote to a book setting later. |
| Session | In memory only. A reload or restart locks. | The old `sessionStorage` flag and the auto-actor from `localStorage` go away. `lastMember` only preselects the member. |
| Existing members | No PIN yet. At sign-in the member sets one (enter twice). Same path as a reset. | No migration data work. Risk: whoever picks a member first sets that member's PIN. Accepted for a family device. |
| Setup | Step 3 "Sen" adds a PIN (twice) for the first admin. Members added in step 4 or later set theirs at first sign-in. | The admin never has an empty-PIN window. |
| Change own PIN | Settings → Members: current PIN, new PIN twice. | Needed to rotate; same fields as set. |
| Reset | Admin, any other member (also another admin). Not self (use change). Clears the hash and the wait counter. | An admin cannot reset self, so a lone admin has no path. |
| Wait counter | Stored in the file (survives restart). After the 30 s, 5 more tries. A good PIN clears it. | A restart must not skip the wait. A changed clock bypasses it; accepted (app gate). |
| Lock keeps work | Idle lock covers the screen but keeps open dialogs and drafts for the **same** member. A different member starts clean. | Losing a half-typed entry to a timer is bad UX. Designer confirms. |
| Reads before sign-in | Only: member list (id, name, color, role, has-PIN flag), group name, currency list, `signIn`, `setPin`, and `setup.run` (first run). All else is rejected with `locked`. | The pick screen and setup need no more. |
| Lone-admin recovery | Restoring a backup brings back the PIN of that backup. It helps only if the old PIN is known. State this in the UI text and docs. | Honest about the owner's "restore from backup" answer. |

## Order
1. **Design** (flow, then screen): flow in `kurulum.md` plus the screens below.
2. **Backend**: migration, hash, operations, gate, tests.
3. **Design screen** uses the Backend operations. In practice: Backend first, then the screen stage.


## Docs and rules that must change
Done (Oct 2026): CLAUDE.md, ARCHITECTURE, ROADMAP, overview, tables, operations and the UX scenarios carry the PIN gate. Current truth lives in [overview](backend/architecture/overview.md#pin-gate-and-session) and [operations](backend/api/operations.md#pin-gate).

## Open questions
See the lead's report. Answers go here when decided.
