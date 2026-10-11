---
name: project-hesaplar-redesign
description: "2026-10-11 Hesaplar rebuilt on ReUI (tree data-grid, detail panel, person fold, cascader dialog); owner decisions and gotchas"
metadata:
  type: project
---

Hesaplar was rebuilt with the ReUI MCP. The ReUI MCP works through browser sign-in (`/mcp` → Authenticate), not a token; the `REUI_TOKEN` header never expanded.

Owner decisions (feedback given while testing):
- Personal-finance app: no Özkaynak KPI card. KPI = two rows of three (Varlık, Borç, Net varlık / Gelir, Gider, Net gelir).
- Same-named accounts of different owners show as one row with owner avatars and a balance tooltip; open with the chevron for per-person rows. No owner = "Bilinmeyen". Folding needs the exact same name.
- Clicking a row selects it and toggles its sub-accounts; right-click menu restored.
- New account dialog: cascader for the group, avatar toggle for the owner, live preview.

**Why:** the owner called Hesaplar "very important" and judged each step on screen.
**How to apply:** new Accounts UI follows these decisions; details in `docs/DEVELOPMENT.md` (ReUI + Chart of Accounts bullets). Check the registry-code patches after a ReUI update. See [[project-core-accounts]].
