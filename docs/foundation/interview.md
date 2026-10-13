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
