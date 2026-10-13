---
owner: backend-engineer
status: active
---

# API first

Named operations in `src/core/api/`. The UI never writes SQL.

- The UI calls only the API, never SQL. The API is named JSON operations: `api.call('entries.post', input)`. The list is `ops` in `src/core/api/index.ts`, with one `API_VERSION`.
- Each op has a Zod (`zod/mini`) input schema, a TypeScript output type and stable error codes. A failure is always an `ApiError` with a `code` (bad input: `invalid_input`). Output schemas come with the plugin bridge.
- `call()` checks the gate (see PIN gate below), validates the input and uses the signed-in member as actor. It writes the `activity_log` row in the same transaction as the op's write. A failed write is logged with its error code (`members.signIn` and `members.setPin` log their own failures). Reads are not logged.
- Records are named by integer `id` in the API. Currencies are named by ISO code.
- Lists are paged (`page`, `pageSize` ≤1000, offset). Journal: newest first. Account register: oldest first, with `opening` and a running balance in the account currency.
- Reports are in the base currency and signed like lines. The trial balance gives debit and credit turnover per account too. The balance sheet returns the unclosed income and expense total as `earnings`.
- Foreign-currency line: the base amount comes from `baseAmount`, else `rate`, else the stored rate on or before the entry date (`rate_missing` if none). A difference up to 1 minor unit per converted line goes to FX Gains and Losses. A larger difference is `entry_unbalanced`.
- Quick Entry flows (Gider, Gelir, Transfer, Borç) are pure builders in `src/core/quick.ts`. They make an `entries.post` input with exact base amounts, so their entries need no FX rounding line.
- An entry edit replaces all lines (old ones get `deleted_at`). The number stays.
- The API does not depend on a transport. v1 uses direct calls in the WebView. Later: plugins and an optional local HTTP or CLI bridge.
- The API runs in the WebView, so outside access needs the app to be open.

## PIN gate
The file is not encrypted; the PIN is an app gate ([overview](../architecture/overview.md#pin-gate-and-session), [plan](../../pin-gate.md)). `createApi(db, {now?})` has no actor argument; `api.lock()` clears the signed-in member.

| Operation | Input | Output | Who | Errors |
|---|---|---|---|---|
| `members.list` | `{}` | `Member[]` with `hasPin` | open | |
| `settings.groupName` | `{}` | `{groupName}` | open | `not_setup` |
| `members.signIn` | `{id, pin}` | `{}` (binds the member) | open | `member_not_found`, `pin_not_set`, `pin_wrong` (`details.triesLeft`), `pin_wait` (`details.seconds`) |
| `members.setPin` | `{id, pin, current?}` | `{}` (does not sign in) | open | `pin_current_required`, `pin_wrong`, `pin_wait`, `pin_not_own`, `pin_exists` |
| `members.resetPin` | `{id}` | `{}` | admin, another member | `admin_only`, `pin_reset_self`, `member_not_found` |
| `setup.run` | adds `pin?` | `{user}` (binds the admin) | open | |

- `pin` and `current` are exactly 6 digits, else `invalid_input`.
- `setPin` with no PIN set needs no `current` (first set). With a PIN, `current` is required and wrong tries share the wait counter. A signed-in member can set only their own (`pin_not_own`).
- Every other op fails with `locked` while no member is signed in.
- `activity_log`: `members.signIn` ok and failed (actor = the member), `members.setPin` with summary `set` or `change` (failed tries too), `members.resetPin` with summary `reset <id>`. No PIN value is ever logged.
