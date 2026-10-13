---
name: project-glossary-paused
description: Glossary and check:terms removed during development; restore before release
metadata:
  type: project
---

`docs/GLOSSARY.md`, `scripts/check-terms.mjs` and the `check:terms` script were removed on 2026-10-13. Last commit that has them: `186d57a`.

**Why:** ideas and decisions change fast; the term list slowed work. The owner wants free work now and discipline before release.
**How to apply:** do not add glossary rows, term checks or "use glossary terms" rules. Keep UI words consistent by habit. Before release, restore the files and fix every hit (listed in `docs/DEVELOPMENT.md` "Before release"). See [[feedback-doc-system]].
