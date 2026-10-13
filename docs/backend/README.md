---
owner: backend-engineer
status: active
---

# Backend

Architecture, database, API and backup in `src/core/` and `src-tauri/`. No UI and no Tauri code in `src/core/`.

| Folder | Content |
|---|---|
| [architecture/](architecture/overview.md) | [overview](architecture/overview.md) (goals, layout, adapters, out of v1), [stack](architecture/stack.md) (technologies) |
| [database/](database/rules.md) | [rules](database/rules.md) (triggers, audit, money), [tables](database/tables.md), [ledger-model](database/ledger-model.md) (GnuCash mapping, account template, currencies) |
| [api/](api/operations.md) | Named operations, errors, reports, paging |
| [runtime/](runtime/backup.md) | [backup](runtime/backup.md) and restore, [performance](runtime/performance.md) budgets |
| `inbox/` | Sources the owner shares for this agent. Rules: [inbox](../inbox/README.md) |

Product decisions and scope (shared): [ARCHITECTURE](../ARCHITECTURE.md).

## Working rules
1. Never edit an applied migration. Add `src/core/migrations/NNNN_name.sql`.
2. Money is a safe-integer `number` in minor units. Rates are text. No float math.
3. A new rule goes into a trigger first; the API pre-checks it for a clear message. Add the error code to `src/core/api/errors.ts` and to both i18n files.
4. A new operation lives in `src/core/api/`, is listed in `index.ts`, and has a test in `api.test.ts`.
5. Minimum check: `npm test && npx tsc --noEmit && npm run lint`. After a change run `graphify update .`.
