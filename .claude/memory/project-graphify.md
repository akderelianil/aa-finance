---
name: project-graphify
description: graphify code graph installed; call graphify directly (WSL2)
metadata:
  type: project
---

graphify (PyPI `graphifyy`) installed via uv on 2026-10-08, project-scoped with strict hooks. Dev moved to WSL2 on 2026-10-08, so call `graphify` directly. Details: docs/DEVELOPMENT.md "Code graph". See [[project-aa-finance-stack]].

**Why:** reduce AI token use when reading code.
**How to apply:** run `graphify query "<q>"` before grepping; `update .` after code changes.
