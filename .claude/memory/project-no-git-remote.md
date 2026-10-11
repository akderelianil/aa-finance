---
name: project-no-git-remote
description: "origin is a local path (/mnt/c/Users/anil-akdereli/aa-finance), no GitHub; push only when the user asks"
metadata:
  type: project
---

`origin` points to a local Windows folder (`/mnt/c/Users/anil-akdereli/aa-finance`), not GitHub. On 2026-10-08 the user said "commit et sadece" and rejected a push; on 2026-10-11 they explicitly asked "commit + push".

**Why:** the remote is a local mirror, not a shared repo.
**How to apply:** commit by default; run `git push` only when the user asks for it in that message. If the push fails, report it, do not work around it. See [[feedback-working-style]].
