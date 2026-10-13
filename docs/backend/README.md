---
owner: backend-engineer
status: active
---

# Backend

Rules, database, API and backup in `src/core/` and `src-tauri/`. No UI and no Tauri code in `src/core/`.

| Doc | Content |
|---|---|
| [local-first](local-first.md) | Stack, database rules, tables, API, backup, budgets |
| [ledger-model](ledger-model.md) | GnuCash mapping, account template, multi-currency |
| [ARCHITECTURE](../ARCHITECTURE.md) | Product decisions and scope (shared) |

## Working rules
1. Never edit an applied migration. Add `src/core/migrations/NNNN_name.sql`.
2. Money is a safe-integer `number` in minor units. Rates are text. No float math.
3. A new rule goes into a trigger first; the API pre-checks it for a clear message. Add the error code to `src/core/api/errors.ts` and to both i18n files.
4. A new operation lives in `src/core/api/`, is listed in `index.ts`, and has a test in `api.test.ts`.
5. Minimum check: `npm test && npx tsc --noEmit && npm run lint`. After a change run `graphify update .`.
