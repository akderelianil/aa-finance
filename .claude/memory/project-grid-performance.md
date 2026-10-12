---
name: grid-performance
description: "2026-10-12 slowness came from data-grid loading skeletons, not the backend; rules in docs/DEVELOPMENT.md"
metadata:
  node_type: memory
  type: project
  originSessionId: feb9529d-4ce5-4622-9802-f342e5141a33
  modified: 2026-10-12T10:22:49.124Z
---

On 2026-10-12 the user reported slow Raporlar and Yevmiye pages. Supabase queries took ~90 ms. The cause was the ReUI data grid: while loading, it drew `pageSize` skeleton rows (25,000 animated cells on Reports). Fixed in P1 ([ROADMAP](../../docs/ROADMAP.md)).

**Why:** a "slow page" report in this app points at the client first; the demo data is ~340 entries.

**How to apply:** for the next slowness report, profile the production build in the browser before you change the database. The grid rules and the speed-check steps are in [DEVELOPMENT](../../docs/DEVELOPMENT.md#ui-and-pages). Related: [Yevmiye redesign](project-yevmiye-redesign.md).
