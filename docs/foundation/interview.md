---
owner: product-lead
status: draft
---

# Foundation interview log (epic foundation-reset, story 1)

Answers are the owner's, translated from Turkish. Assistant challenges are marked **Challenge**. Nothing here is a decision yet; decisions go to ADRs (story 5).

## Round 1 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Why | GnuCash is the closest tool but uses old technology, has weak UX and no "family" concept. Family members do not know accounting, so they could not keep their own records. Records not kept to professional accounting standards are not useful. Goal: a personal-finance app built on a General Journal, offering professional accounting standards to the end user. |
| 2 | Business model | Family first. Then open source plus a paid membership. Local use is free; online features (storage, sync, multi-device) are paid. The free tier uses no server and no storage service. |
| 3 | Users and devices | 1 to 10 people per family. Desktop, tablet and mobile. Desktop first; mobile later on demand, native (Kotlin/Swift). |
| 4 | Mobile timing | Needed, but only after the desktop app matures. |
| 5 | Volume and life | Hard to predict; millions of records would take a long time. Keep every record at least 10 years; goal is unlimited retention where possible. |
| 6 | Accounting depth | Backend: full double entry. Front end: simple. Guide non-accountants, simplify terms, speak plain language, possibly gamify entry, build processes from scenarios. |
| 7 | Tax and law | Not needed. No e-invoice or tax return. Users track their own finances. |
| 8 | Currencies and assets | All currencies, worldwide use. Investments: gold, stocks, crypto, funds, commodities. Manual entry first; later add-ons and integrations pull data. The user-given rate always wins (example: market 50 TRY/USD, Ahmet paid 49.9594). |
| 9 | Threats | File corruption and accidental deletion. Users are responsible for their own device security. |
| 10 | Data loss | Never acceptable. Years of records lost would waste all analysis and plans. |
| 11 | Stack and upkeep | Stack chosen by chance. Ready to write Rust. Claude Code maintains the code entirely. |
| 12 | Success | UX/UI must be close to perfect. A person with no accounting knowledge must run all life finance decisions without knowing debit/credit, using daily terms. Examples: lend/borrow (money, gold, silver, shares), loans (vehicle, home, personal), buying funds or shares, card purchases, card instalments, buying and selling currency, transfers. The "building that falls" remark comes from a precaution, not a past failure. |

## What this changes (assistant analysis, to be argued in round 2)
See the epic stories. Items that contradict the current docs: sync is no longer out of scope, mobile is no longer out of scope, the UI must hide accounting terms (CLAUDE.md says the UI uses them), investments need quantities and prices (not only money), and "no data loss" needs a stated recovery target.

## Round 2 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| A1 | Cloud-folder sync (free tier) | Allowed; warn the user and state that the risk is theirs. |
| A2 | Encryption and accounts | End-to-end encrypted. Privacy and security are the first priority. Recovery key and/or Google/Apple identity; owner is unsure how membership should work. |
| A3 | Offline and conflicts | Offline work required. Same record edited by two members: the first to reach the server wins. |
| A4 | License | Fully open source, MIT. |
| B5 | Visibility | Not everyone reads everything (children). Chosen people can see all records. Default: a member sees only their own records. |
| B6 | Leaving a family | A leaving member does not take records (they affect family reports and goals). One person belongs to one family only. |
| C7 | Cost basis | The user picks the method. Realized and unrealized gain/loss reports are mandatory. Multi-currency needs daily price data. |
| C8 | Precision | Set per currency/commodity, like GnuCash. Wants the assistant's view. |
| C9 | Prices | A price history table is wanted. |
| D10 | Platforms | Windows, macOS and Linux must all work without problems. |
| D11 | Scale | 100k to 1M entries is ambitious; performance is a priority. |
| D12 | Append-only | Accepted for the backend; the UI must still offer create, edit and delete. |

## Round 3 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Visibility unit | Per account. Backend and server follow accounting standards fully; the UI adapts with its own logic. |
| 2 | Who sees all | Not only the admin: any member granted access to accounts. Discuss RBAC and decide. |
| 3.1 | Cloud-folder file | Accepted: detect and refuse by default, allow with explicit override. |
| 3.2 | Conflicts | Accepted: the losing edit is kept and shown as a conflict, never dropped. |
| 3.3 | License | Accepted: clients and core MIT, server AGPL. |
| 3.4 | Leaving a member | Accepted: the member may export all their data in any format; the family keeps the same records so reports stay intact. |
| 3.5 | Crypto precision | Unsure (Bitcoin and altcoins). Research it with a data-engineer view. |
| 3.6 | Erasure | Accepted: a user can delete all their data at once. |
| 4 | Recovery model | Did not understand the question; re-ask in plain words. |
| 5 | Local file encryption | No. All data sits on the user's own device; the OS protects it; the user is responsible. |
| 6 | Attachments | Yes, backlog (receipts, invoices, files). |
| 7 | Import/export | Yes, backlog. |
| 8 | UI technology | Low React/ReUI attachment (used only for shadcn components). Priorities in order: 1 compatibility, 2 low resource use, 3 performance, 4 privacy and security. Wants "close to native". Open to critique. |
| 9 | Locked-period edits from old devices | Apply the assistant's proposal: keep as a conflict. |
| 10 | Business | No device or person limit in the free tier. The owner runs the sync server alone and carries cost and operations. |

## Round 4 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Priority order | Accepted: 1 data integrity, 2 privacy and security, 3 compatibility, 4 resource use, 5 performance. |
| 2 | Shared computer | Accepted: real separation only on separate devices; a shared computer gets an app gate only, said openly. |
| 3 | Hidden from admin | Accepted: no account can be hidden from the admin. |
| 4 | Recovery | Accepted: recovery key mandatory at setup, family-assisted recovery by default, key loss means cloud data loss. |
| 5 | Server budget | Cloudflare or Hetzner. Up to 25 USD per month at the start; can rise with revenue. |
| 6 | Cost method change | Recalculate past gains. Normally forward only, but the app is for non-accountants, so flexibility is allowed. |
| 7 | Prices | All entry and prices manual in the first version. |
| 8 | Calendars, time zones | Probably all needed (unsure). |
| 9 | Languages | English and Turkish for the first version. |
| 10 | Deadline | None. Quality over time. |
| + | Extensibility | Other developers must be able to extend the app; plugins; the API matters. |
| + | Philosophy | Follow Obsidian's philosophy (loved worldwide, developer- and user-centred). Open source is a deliberate owner choice. Obsidian is the example to follow. |

## Round 5 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Plugin power | Accepted: permissioned and sandboxed, weaker than Obsidian plugins on purpose. Only official plugins at first. |
| 2 | Distribution | Only plugins approved by the owner can be installed in the first period. |
| 3 | Data promise | Open documented schema plus full export at any time; CSV export of all data is enough. |
| 4 | Cost method change | Accepted: the system posts automatic adjustment entries. |
| 5 | Calendar | Accepted: Gregorian civil date stored; other calendars are display only. |
| 6 | Self-hosting | Deliberately supported; the owner trusts the community to donate and subscribe anyway. |
| 7 | Contribution policy | Did not understand; re-ask in plain words. |
| 8 | Telemetry | Asked for an explanation first. |
| 9 | Existing code | Do not keep as reference; learn from the experience and write a better version from scratch. |
| 10 | Discovery | Continue. |

## Round 6 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Budget, goals, plans | Yes, backlog. The owner wants to discuss the other backlog ideas too. |
| 2 | Instalments and loans | Show estimated future payments, never in the journal. A transaction is a completed event; an unrealized payment cannot be posted. Loan interest (principal/interest split) is computed automatically. |
| 3 | Bank import, reconciliation | Not out of scope; backlog. |
| 4 | First reports | Balance Sheet, Income Statement, Cash Flow. |
| 5 | Valuation | Reports and balances show the latest price, virtually (no ledger entry), with an info tip warning. |
| 6 | Business use | No. Personal finance only; not designed for commercial use. |
| 7 | Automatic backup | Accepted. |
| 8 | Undo | Accepted. Also an activity history (which user did what, when, what changed); backlog. |
| 9 | Scenarios as data | Did not understand; explain. |
| 10 | Billing and entity | Based in Turkey. No own business; a family company exists and can be used for licenses and documents if needed. |

## Round 7 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Backlog | Discuss one by one, as questions and answers. Owner then listed ideas (see docs/foundation/backlog.md). |
| 2 | Cash flow report | Simple (cash in and out), not the formal statement. |
| 3 | Investment gain/loss report | Yes, in the first version. |
| 4 | Instalments and loans | The figure the user takes from the bank wins. Estimates and forecasts are for planning only; the user's real record always wins. |
| 5 | Scenarios | Data-driven (templates run by a generic engine), so they can adapt to countries, situations and people, and developers can contribute. |
| 6 | First release | Local and free only. Paid features such as sync come in a later release. |
| 7 | Notifications | Backlog, but very important. |
| 8 | Most urgent scenarios | Income/Expense, Transfer, Borrow/Lend. |

## Round 8 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | First release scope | Option B: income/expense, transfer, debt; Balance Sheet, Income Statement, simple Cash Flow; multi-currency. Investments and the gain/loss report move to the next release; the data model carries them from day one. |
| 2 | Sync readiness | Accepted: global ids, an event log, undo records from the start. "Keep telling me the truth and steer me." |
| 3 | Idea picks | Top five: 1 Quick entry (UI + API/CLI; important), 2 privacy mode, 3 asset card, 4 credit-card cycle, 5 net worth and reports in another currency or unit. All other assistant ideas go to the backlog. |
| 4 | Vehicles and property | Accepted: value estimate history instead of mandatory depreciation (example: a February estimate from used-market prices). |
| 5 | Notifications | Must arrive while the app is closed (a due date needs a reminder). |
| 6 | Credit card | Confirmed: statement day, limit, interest rates and related card facts per card; instalments tie to the cycle. |
| 7 | Child mode | Removed. Every user is 18 or older. |
| 8 | Closing discovery | Yes, close with this round if no new topic appears. |

## Deferred to story 4 (technical research, not owner questions)
- Crypto and commodity amount storage (range versus decimals); research with a data-engineer view.
- UI and shell technology (Tauri, Flutter, Compose Multiplatform, native, Electron); spike.
- Language of the shared core (Rust with UniFFI is the leading candidate).
- Sync protocol, server shape (Cloudflare Workers + Durable Objects + R2 versus a portable server), self-hosting.
- Key hierarchy and family key rotation; passkey and recovery details.
- Permission model details (RBAC per account), masked counter-lines.
- Plan/schedule entity, loan and card calculators, background notification service per operating system.
- Plugin sandbox (WASM or process), permission manifest, API versioning.
Outside this epic: payment provider and company set-up (Turkey), legal advice.

## Assistant positions the owner accepted or has not yet contested
Accepted: RBAC over visible accounts, live database refuses to open in a cloud-synced folder, conflict losers kept, server AGPL and clients MIT, leaving members receive a copy, E2EE with mandatory recovery key, plugins sandboxed and permissioned, append-only with revisions, owner data promise = open schema plus CSV export plus a separate full restorable backup.
Open for the owner to confirm: DCO versus CLA (explained in round 5 answer), telemetry off by default with opt-in crash reports (explained), full backup file separate from CSV export (explained), scenario templates as data (accepted in round 7).

## Round 9 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Contributions | DCO. |
| 2 | Telemetry | Off by default; crash reports only with consent. Accepted. |
| 3 | Backup | CSV export and a separate full restorable backup. Accepted. |
| 4 | Authority | Full authority to update CLAUDE.md, memory, rules and docs so that no old rule or philosophy remains. Done in the same commit. |
| 5 | Notifications | Very important for the architecture but not urgent: backlog, not in v1. |

## Vision review (2026-10-13)
Owner approved the vision with one change: remove the "adults 18+" statement; no notice and no restriction, a general user. A child-specific mode stays unplanned. Assistant note: if minors use the app, the terms of use still need a line about it; end-to-end encryption keeps the hosted service blind to the data.

## Round 10 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Rust core | Accepted; the owner supports it. |
| 2 | Spike | No spike: judge from benchmarks and reviews on the internet (React, Tauri, Flutter, plus any other candidate). |
| 3 | Look | Identical on every operating system (like Obsidian), so users who change device or system are not confused. |
| 4 | Accessibility | Mandatory. |
| 5 | OS versions | Recent versions; nothing old. |
| 6 | Test machines | None. GitHub Actions matrix (owner has Pro; the repo will be public). |
| 7 | UI plugins | Not needed soon; after the product matures. |
| 8 | Mobile technology | Did not understand; explained with examples in the next reply. |

## Round 11 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Chromium shell | Accepted, including the RAM and installer cost. |
| 2 | Mobile | Option B: native screens. Desktop and mobile have different purposes: mobile is for daily, quick actions and simple information; analysis and planning happen on the computer. Desktop first; decide later which features go to mobile and how. Asked for the assistant's opinion and criticism. |
| 3 | Signing | No budget now; no store listings; do it later when the app earns money. |
| 4 | OS versions | Accepted: Windows 10 22H2 and 11, macOS 13+, Ubuntu 22.04+ and equivalents. |
| 5 | Performance budgets | Do not set limits now; build correct, high quality first, then measure and optimize. |
| 6 | Web UI | React stays; keep using ReUI (shadcn) where possible. |

## Round 12 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Entry numbers | Drop gapless numbers. The user may want to write the identity number of a bought product or service invoice: an optional free "No" field. |
| 2 | Dust rounding | Did not understand; explained with an example in the next reply. |
| 3 | History scope | Everything has revisions (entries, accounts, prices, settings, members). |
| 4 | Period lock | Keep, at the admin's choice. |
| 5 | Book currency | Fixed per ledger; reports can show any unit. A later re-base tool is welcome. |
| 6 | Archive | Accounts and commodities in use are archived, never deleted. |
| 7 | Independent review | Yes: database-reviewer and architect run on options 02 (results follow). |

## Round 13 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| fb | Creation time in ids | Not a meaningful leak; this is not a state-level privacy product. Use time-ordered ids. |
| 1 | Dust rounding | Accepted: rounded, shown as a visible "Rounding" line. |
| 2 | Partly visible entries | Accepted. The child may also see the account label; no "Hidden account" label is needed because the group's members are known (accounts exist by invitation). Avoid trivial logic slips like that. |
| 3 | Revoke | Accepted: only future records stop flowing; old synced data cannot be unseen. |
| 4 | Erasure | Accepted: a member erases their own personal data (shared-account entries keep the author as a "deleted member"); the admin erases the whole family ledger with extra confirmation. No other rules. |
| 5 | CLI | Accepted: a local token bound to a member and that member's permissions. |
| 6 | Period lock | Accepted: freezes edits; a late edit waits for an admin. |
| 7 | Units | No other unit needed now; design the unit table to extend. |

## Round 14 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Server choice | Check the Cloudflare pricing page before choosing (done, see options 03). |
| 2 | Sync outage | A few hours is acceptable. |
| 3 | Update speed | Prefers instant updates on other devices. |
| 4 | Region | EU, Germany preferred. |
| 5 | Quota | Decide later. |
| 6 | Self-hosting | Accepted: Docker image and docs, no user support. |

## Round 15 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Region | EU is enough (Germany not required). |
| 2 | Server language | TypeScript on Workers accepted. |
| 3 | Security review | Yes: independent security review of the key design. |
| + | Self-hosting idea | Send self-hosters to their own Cloudflare account instead of a VPS and Docker, to avoid extra work. Asked for the assistant's opinion. |

## Round 16 and 17 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Self-host | All costs accepted; self-hosters are sent to their own Cloudflare account (no VPS or Docker server). Cloudflare is the choice. |
| 2 | Second admin | The app recommends it strongly. |
| 3 | New grant | A newly granted member also sees the account's history. |
| 4 | Backup passphrase | Offered; the user chooses. |
| 5 | Email one-time code | Accepted for the first registration on the hosted service. |
| 6 | Signing gate | Did not understand; explained in plain words in the next reply. |
| 7 | Out-of-band check | Mandatory (QR or short code) when joining a family. |
| 8 | Admin actions | Accepted: a second admin, when present, co-signs admin-granting actions. |
| 9 | Recovery key use | Notify every member. |

## Round 18 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 | Signing gate | Accepted: paid sync does not start before signing is in place. |
| 2 | Community scenario packs | Allowed from the start, reviewed as pull requests. |
| 3 | Price plugins | Prices from a provider plugin are inserted automatically, marked fetched; the user's own price outranks them; entries always wait for approval. |
| 4 | Plugin rule | Accepted: no plugin holds ledger read and network together. |

## Round 19 (2026-10-13)

| # | Topic | Owner answer |
|---|---|---|
| 1 to 4 | Notifications | Accepted: login-time reminder helper with explicit consent; minimal text by default; first release covers due plan items; macOS after signing. |
| 5 | Mutation testing and fuzzing | Accepted. |
| 6 | Coverage floor | Accepted: 80 percent overall, 100 percent on money, rules and crypto. |
| 7 | Accessibility | Asked whether to shelve accessibility until the app has grown and has users. Assistant: shelve only the manual screen-reader testing (see options 07, ADR-0018). Awaiting the owner's reply. |

## Round 20 (2026-10-13)
Owner agrees: accessibility is built in from the first screen (not deferred); only manual screen-reader testing waits for users. ADR-0018 stands as written.
