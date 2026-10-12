---
name: grid-performance
description: ReUI data-grid draws pageSize skeleton rows while loading; long grids use useGridPages (lib/grid.ts)
metadata:
  node_type: memory
  type: project
  originSessionId: feb9529d-4ce5-4622-9802-f342e5141a33
  modified: 2026-10-12T10:21:43.551Z
---

The ReUI DataGrid draws one skeleton row per `pageSize` row while `isLoading`. On 2026-10-12, a large pageSize (5000) froze the first visit to Raporlar for 7–12 s (25,000 animated cells); the backend took only ~90 ms per query.

**Why:** the slowness came from the skeleton DOM, not from data volume. The demo data is ~340 entries.

**How to apply:** a grid with a large pageSize uses `pageSize: loading ? 10 : N`. Long lists (Yevmiye, Hesap Kartı) use `useGridPages` + `DataGridPagination` + `autoResetPageIndex: false`. Reports and the Hesap Planı tree stay unpaged. To measure, use `vite preview` (production build), not dev; the PWA service worker can serve a stale build after a rebuild. Related: [Yevmiye redesign](project-yevmiye-redesign.md).
