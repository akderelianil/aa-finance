---
owner: product-lead
status: active
---

# Rules trace

Each Product rule in [CLAUDE.md](../CLAUDE.md#product-rules) with where it is enforced and the test that proves it. `test: <title>` is the exact title of a test in the repo; a test fails when a named test disappears or when a rule has no row. `test: NONE` means no automated test fits (scope, absence of a feature, or UI work still to do). Behavior specs per capability: [backend/specs](backend/specs/README.md). Why: [ADRs](adr/README.md).

## Rules
| Rule | Summary | Evidence |
|---|---|---|
| PR-1 | Ledger core first | judgment, not testable |
| PR-2 | Accounting standards, simple chart, locked roots and system groups | PR-2.1 to PR-2.2 |
| PR-3 | Every entry has ≥2 lines and balances on `base_amount` | PR-3.1 to PR-3.2 |
| PR-4 | Every account has a currency; rates are manual (given rate > given base > stored > `rate_missing`) | PR-4.1 to PR-4.5 |
| PR-5 | A journal entry is a completed event only | absence of a feature |
| PR-6 | One file = one family; roles; own-entry rule; PIN gate | PR-6.1 to PR-6.7 |
| PR-7 | Number and date format follow the book country | PR-7.1 (partial) |
| PR-8 | Entry flows: Gider, Gelir, Transfer, Borç, Serbest kayıt | PR-8.1 to PR-8.4 |
| PR-9 | Out of scope: AI, bank import, notifications, bills, sync, mobile | absence of features |

## Evidence
| Id | Rule | Enforced by | Proof |
|---|---|---|---|
| PR-1.1 | PR-1 | review against the ROADMAP | test: NONE |
| PR-2.1 | PR-2 | `src/core/chart.ts`, `setup.run`; locked roots (`account_locked`) | test: setup writes the core chart, optional recommended accounts, and runs once |
| PR-2.2 | PR-2 | triggers `account_parent_type`, `account_parent_cycle`, `account_has_children`, `account_has_lines` | test: account tree rules |
| PR-3.1 | PR-3 | triggers `entry_too_few_lines`, `entry_unbalanced`; API check first | test: posting needs two balanced lines and assigns numbers per year |
| PR-3.2 | PR-3 | API `entries.post` with database codes surfaced | test: entries: post, number, balances, and database rules as codes |
| PR-4.1 | PR-4 | stored rate, given rate, given base, rounding to `fx_gain_loss`, `rate_missing` | test: foreign currency: stored rate, given rate, given base, rounding to FX, missing rate |
| PR-4.2 | PR-4 | triggers `line_rate_required`, `line_base_mismatch`, `base_currency_missing` | test: amounts: integers only, nonzero, same sign; base and rate follow the account currency |
| PR-4.3 | PR-4 | `fx.set` updates a date's rate (`fx_rate_exists` otherwise) | test: fx.set on an existing date updates the rate instead of adding a row |
| PR-4.5 | PR-4 | a given rate wins over a given base amount, which wins over the stored rate | test: a given rate wins over a given base amount, which wins over the stored rate |
| PR-4.4 | PR-4 | `fx.list`, `fx.delete` (soft delete) | test: fx.list returns live rates newest first, filtered by currency; remove hides a rate |
| PR-5.1 | PR-5 | no plan or reminder tables; entries are `draft` then `posted` | test: NONE |
| PR-6.7 | PR-6 | grants: `permission_denied` by API and triggers; only the admin changes them | test: without a grant a member cannot change accounts, rates or contacts; reading stays open |
| PR-6.6 | PR-6 | `members.remove`: admin only, not self, last admin stays | test: members.remove: admin only, another member only, entries and history stay |
| PR-6.1 | PR-6 | triggers `entry_not_owner`, `admin_only`, `last_admin` | test: members: setup adds them, admin manages, a member edits only own name and own entries |
| PR-6.2 | PR-6 | `openOps` gate: locked, only open ops run | test: pin: locked gate lets only the open ops through; sign in binds, lock clears |
| PR-6.3 | PR-6 | 5 wrong tries → 30 s wait, kept in the file | test: pin: 5 wrong tries wait 30 s, restart keeps it, recovery after the wait, success clears |
| PR-6.4 | PR-6 | admin reset, not self | test: pin: admin resets another member, not self; a member cannot reset |
| PR-6.5 | PR-6 | hash stored, never logged | test: pin: setup stores the first admin PIN with the hash, never in audit_log; setup binds the admin |
| PR-7.1 | PR-7 | decimal parsing for both separator styles; the locale choice (`formatLocale`) has no test yet (story 6) | test: parseDecimal accepts both separator styles and returns a canonical string |
| PR-8.1 | PR-8 | `quick.ts` expense builder | test: expense: splits on a card; a foreign payment converts with the last split taking the rounding |
| PR-8.2 | PR-8 | `quick.ts` income builder | test: income: received into an asset, split over income accounts |
| PR-8.3 | PR-8 | `quick.ts` transfer builder | test: transfer: ATM with fee, card payment, and across currencies |
| PR-8.4 | PR-8 | `quick.ts` debt builder | test: debt: lend, borrow, collect, repay move the right sides |
| PR-9.1 | PR-9 | no code for these features | test: NONE |

## Open gaps
- PR-6: the grants UI (Settings > Members) and the hidden controls were checked by hand in the browser, not by an automated test; story `harness-plan-6` adds E2E.
- PR-7: no test for the book-country locale (`formatLocale`); story `harness-plan-6` moves it to a pure module and tests it.
- PR-1, PR-5, PR-9: scope and absence rules; reviewed by hand against the ROADMAP.
- UI terms in PR-2 (Yevmiye, Hesap Planı, Mizan…) are checked by the i18n tests only for key completeness, not wording.
