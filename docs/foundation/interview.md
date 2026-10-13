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
