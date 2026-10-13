---
owner: backend-engineer
status: partly resolved
---

# Findings from spec mining (2026-10-13)

Behavior the code shows that differs from, or is missing in, the written rules. Each item needs a decision: change the code, or change the rule. Source ids refer to the specs in this folder. Owner decisions of 2026-10-13 are marked below.

| # | Finding | Where | Decision needed |
|---|---|---|---|
| 1 | CLAUDE.md says "user-given rate wins, else stored rate". The code ranks a given `baseAmount` above a given `rate`; if both are sent both are stored with no agreement check. | `entries.ts:58-67`, LEDGER-032 | **Decided: a user-given rate wins, then a given base, then stored. Done** (`entries.ts`, test, docs) |
| 2 | A date-only edit keeps each foreign line's old rate and base; the stored rate for the new date is never looked up. | `entries.ts:121-131`, LEDGER-017 | Intended (documented in rules.md) or re-convert? |
| 3 | Moving an entry to another year keeps its first number; `year` then differs from the date's year. | trigger `entries_number` (0007), LEDGER-033 | Confirm: number stays, year stays |
| 4 | `pin-gate.md` lists four ops open while locked; the code also opens `currencies.list` and `setup.run`. | `api/index.ts` (`openOps`) | **Done**: pin-gate.md now lists them |
| 5 | Rules enforced only in the API, not by triggers: no `fx_rates` row for the base currency; `resetPin` admin only, `pin_reset_self`, `pin_not_own`; `entries.deleteAll` admin only (a member can soft delete all of their own entries). | `fx.ts`, `members.ts`, `entries.ts` | Open: add triggers with story `harness-plan-9` where they belong to the role design |
| 6 | No role gate on shared data: any member can change accounts, FX rates and contacts. ARCHITECTURE.md makes only book settings admin only. | accounts, fx, contacts ops | **Decided: roles are needed; the admin grants who sees and does what. Open: story `harness-plan-9`** |
| 7 | No op removes a member, though CLAUDE.md says the admin manages members and the triggers already handle `deleted_at` (`actors_last_admin`). | `members.ts` | **Decided: members can be removed. Done** (`members.remove`, MEMBER-023) |
| 8 | `contacts.balances` counts only Receivables/Payables and their direct children; deeper sub-accounts are left out. | `contacts.ts:39-54`, CONTACT-006 | **Decided: all depths. Done** (recursive query, test) |
| 9 | The 5-minute idle lock is a UI constant outside `src/core`, so no spec covers it. | UI | Cover it in the E2E story |
| 10 | While locked, whoever picks a member without a PIN sets it, including an admin whose PIN was just reset. | `members.setPin` | Accepted in pin-gate.md; for the security review |

Also: 11 blocks have `test: NONE` (LEDGER-003/017/032/033, ACCT-015, MEMBER-002/021, FX-016, CONTACT-006/011, REPORT-007). The three `status: unverified` ones (LEDGER-017/032/033) are findings 1 to 3.
