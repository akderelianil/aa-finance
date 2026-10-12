---
name: project-member-switch
description: "2026-10-12 sidebar group menu switches the viewed family member; journal-post member_id books on behalf with edit access"
metadata:
  type: project
---

Sidebar "Demo Ailesi" button opens an "Aile üyeleri" menu (`GroupHeader`). Selection lives in `web/src/lib/viewAs.tsx` (localStorage per member). Another member selected → Journal filtered to their entries, note shown; new-entry buttons (sidebar Quick, Journal) disabled unless the caller has `edit` (or is admin). `journal-post` create takes optional `member_id` (checked with `canModify`), `created_by` = caller. Deployed to the dev project.

**Why:** owner wanted to switch between family members' accounts, with Settings → Kayıt izinleri deciding view-only vs create/delete.

**How to apply:** Accounts and Reports are not filtered by member yet (open call). Own view (default) still shows all entries. See [[project-ledger-core-pivot]].
