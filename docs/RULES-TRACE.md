---
owner: product-lead
status: active
---

# Rules trace

Each Product rule in [CLAUDE.md](../CLAUDE.md#product-rules) with where it is enforced and the test that proves it. `test: <title>` is the exact title of a test in the repo; a test fails when a named test disappears or when a rule has no row. `test: NONE` means no automated test fits yet (the rule belongs to the rebuild, epic `foundation-reset`, or is about scope). Rows that cite a test prove the **retired prototype**; the rebuild must carry the same behavior, then the rows point at new tests. Behavior specs: [backend/specs](backend/specs/README.md). Why: [ADRs](adr/README.md), [foundation](foundation/README.md).

## Rules
| Rule | Summary | Evidence |
|---|---|---|
| PR-1 | Purpose: a family ledger for people with no accounting knowledge; adults only; personal use | PR-1.1 |
| PR-2 | Strict double entry, balanced in the base currency, enforced by the database; append-only revisions; change log | PR-2.1 to PR-2.6 |
| PR-3 | Daily-language UI with scenario templates; an entry is a completed event; plans are separate | PR-3.1 to PR-3.2 |
| PR-4 | Currencies and commodities, manual values win, price history, virtual valuation, cost method | PR-4.1 to PR-4.6 |
| PR-5 | One family, roles per account, admin sees all, shared computer is only a gate | PR-5.1 to PR-5.10 |
| PR-6 | Local first and free; backups, export, cloud-folder refusal, erase all | PR-6.1 |
| PR-7 | Paid sync later, sync-ready model, E2EE, recovery key, conflicts kept | PR-7.1 |
| PR-8 | Privacy: no telemetry by default, opt-in crash reports | PR-8.1 |
| PR-9 | Plugins: sandboxed, permissioned, named API only | PR-9.1 |
| PR-10 | Civil Gregorian dates; format follows the book country; Turkish and English | PR-10.1 to PR-10.2 |
| PR-11 | First release scope: income/expense, transfer, debt; three reports; multi-currency | PR-11.1 to PR-11.5 |
| PR-12 | Early picks after v1 basics | PR-12.1 |
| PR-13 | Licenses and DCO | PR-13.1 |
| PR-14 | Out of scope: AI, tax, business, child accounts | absence of features (PR-14.1) |

## Evidence
| Id | Rule | Enforced by | Proof |
|---|---|---|---|
| PR-1.1 | PR-1 | review against the ROADMAP | test: NONE |
| PR-2.1 | PR-2 | triggers `entry_too_few_lines`, `entry_unbalanced`; API check first | test: posting needs two balanced lines and assigns numbers per year |
| PR-2.2 | PR-2 | API `entries.post` with database codes surfaced | test: entries: post, number, balances, and database rules as codes |
| PR-2.3 | PR-2 | prototype: no table allows DELETE (target: append-only revisions) | test: no table allows DELETE |
| PR-2.4 | PR-2 | prototype: audit_log (target: one change log) | test: audit_log records every write with its actor and cannot change |
| PR-2.5 | PR-2 | `src/core/chart.ts`, `setup.run`; locked roots (`account_locked`) | test: setup writes the core chart, optional recommended accounts, and runs once |
| PR-2.6 | PR-2 | triggers `account_parent_type`, `account_parent_cycle`, `account_has_children`, `account_has_lines` | test: account tree rules |
| PR-3.1 | PR-3 | no plan or reminder tables; entries are `draft` then `posted` | test: NONE |
| PR-3.2 | PR-3 | scenario templates run by a generic engine | test: NONE |
| PR-4.1 | PR-4 | stored rate, given rate, given base, rounding to `fx_gain_loss`, `rate_missing` | test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate |
| PR-4.2 | PR-4 | triggers `line_rate_required`, `line_base_mismatch`, `base_currency_missing` | test: amounts: integers only, nonzero, same sign; base and rate follow the account currency |
| PR-4.3 | PR-4 | `fx.set` updates a date's rate (`fx_rate_exists` otherwise) | test: fx.set on an existing date updates the rate instead of adding a row |
| PR-4.4 | PR-4 | `fx.list`, `fx.delete` (soft delete) | test: fx.list returns live rates newest first, filtered by currency; remove hides a rate |
| PR-4.5 | PR-4 | a given rate wins over a given base amount, which wins over the stored rate | test: a given rate wins over a given base amount, which wins over the stored rate |
| PR-4.6 | PR-4 | commodities, price history, lots, cost method, adjustment entries, virtual valuation | test: NONE |
| PR-5.1 | PR-5 | triggers `entry_not_owner`, `admin_only`, `last_admin` | test: members: setup adds them, admin manages, a member edits only own name and own entries |
| PR-5.2 | PR-5 | grants: `permission_denied` by API and triggers; only the admin changes them | test: without a grant a member cannot change accounts, rates or contacts; reading stays open |
| PR-5.3 | PR-5 | `members.remove`: admin only, not self, last admin stays | test: members.remove: admin only, another member only, entries and history stay |
| PR-5.4 | PR-5 | `openOps` gate: locked, only open ops run | test: pin: locked gate lets only the open ops through; sign in binds, lock clears |
| PR-5.5 | PR-5 | 5 wrong tries → 30 s wait, kept in the file | test: pin: 5 wrong tries wait 30 s, restart keeps it, recovery after the wait, success clears |
| PR-5.6 | PR-5 | admin reset, not self | test: pin: admin resets another member, not self; a member cannot reset |
| PR-5.7 | PR-5 | hash stored, never logged | test: pin: setup stores the first admin PIN with the hash, never in audit_log; setup binds the admin |
| PR-5.8 | PR-5 | grants UI: no "New account" without the grant, visible after the admin grants it (browser) | test: a member sees "New account" only after the admin grants accounts |
| PR-5.9 | PR-5 | idle lock, then another member, then the same member again: the open dialog and draft come back (browser) | test: an open Quick Entry draft comes back when its member signs in again |
| PR-5.10 | PR-5 | per-account roles, admin sees all, masked counter-lines | test: NONE |
| PR-6.1 | PR-6 | automatic verified backup, full backup, CSV export, cloud-folder refusal, erase all | test: NONE |
| PR-7.1 | PR-7 | global ids, event log, E2EE, recovery key, conflicts | test: NONE |
| PR-8.1 | PR-8 | no telemetry by default, opt-in crash report | test: NONE |
| PR-9.1 | PR-9 | plugin sandbox, permissions, named API only | test: NONE |
| PR-10.1 | PR-10 | decimal parsing for both separator styles | test: parseDecimal accepts both separator styles and returns a canonical string |
| PR-10.2 | PR-10 | `formatLocale`: the book country picks the locale, the UI language is the fallback | test: formatLocale gives the country locale, whatever the UI language |
| PR-11.1 | PR-11 | `quick.ts` expense builder | test: expense: splits on a card; a foreign payment converts with the last split taking the rounding |
| PR-11.2 | PR-11 | `quick.ts` income builder | test: income: received into an asset, split over income accounts |
| PR-11.3 | PR-11 | `quick.ts` transfer builder | test: transfer: ATM with fee, card payment, and across currencies |
| PR-11.4 | PR-11 | `quick.ts` debt builder | test: debt: lend, borrow, collect, repay move the right sides |
| PR-11.5 | PR-11 | Gider through the real UI: setup, PIN, Quick Entry, journal, trial balance (browser) | test: setup, PIN, Quick Entry, journal, trial balance |
| PR-12.1 | PR-12 | quick entry, privacy mode, asset card, card cycle, other-unit net worth | test: NONE |
| PR-13.1 | PR-13 | licenses and DCO | test: NONE |
| PR-14.1 | PR-14 | no code for these features | test: NONE |

## Open gaps
- Rules PR-3.2, PR-4.6, PR-5.10, PR-6 to PR-9, PR-12 and PR-13 have no code yet; they are the rebuild.
- PR-1, PR-12 to PR-14 are scope and judgment rules, reviewed by hand against the [ROADMAP](ROADMAP.md).
