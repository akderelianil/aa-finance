---
owner: backend-engineer
status: active
---

# API first

Named operations in `src/core/api/`. The UI never writes SQL.

- The UI calls only the API, never SQL. The API is named JSON operations: `api.call('entries.post', input)`. The list is `ops` in `src/core/api/index.ts`, with one `API_VERSION`.
- Each op has a Zod (`zod/mini`) input schema, a TypeScript output type and stable error codes. A failure is always an `ApiError` with a `code` (bad input: `invalid_input`). Output schemas come with the plugin bridge.
- `call()` validates the input and binds the actor. It writes the `activity_log` row in the same transaction as the op's write. A failed write is logged with its error code. Reads are not logged.
- Records are named by integer `id` in the API. Currencies are named by ISO code.
- Lists are paged (`page`, `pageSize` ≤1000, offset). Journal: newest first. Account register: oldest first, with `opening` and a running balance in the account currency.
- Reports are in the base currency and signed like lines. The trial balance gives debit and credit turnover per account too. The balance sheet returns the unclosed income and expense total as `earnings`.
- Foreign-currency line: the base amount comes from `baseAmount`, else `rate`, else the stored rate on or before the entry date (`rate_missing` if none). A difference up to 1 minor unit per converted line goes to FX Gains and Losses. A larger difference is `entry_unbalanced`.
- Quick Entry flows (Gider, Gelir, Transfer, Borç) are pure builders in `src/core/quick.ts`. They make an `entries.post` input with exact base amounts, so their entries need no FX rounding line.
- An entry edit replaces all lines (old ones get `deleted_at`). The number stays.
- The API does not depend on a transport. v1 uses direct calls in the WebView. Later: plugins and an optional local HTTP or CLI bridge.
- The API runs in the WebView, so outside access needs the app to be open.
