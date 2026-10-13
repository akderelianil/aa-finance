---
name: feedback-working-style
description: "How the user wants to work: Turkish chat, ask options on real decisions, critical pushback, minimal scope, commit phases without asking"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 65aee460-9522-404c-8783-aca9f19cf8c3
  modified: 2026-10-12T11:08:29.422Z
---

- Chat in Turkish. Docs/code in English; `docs/product-designer/ux/**` in Turkish.
- On real tech/schema/product decisions, offer 2-4 options with a recommendation (AskUserQuestion); the user decides. Do not plan alone ("Her şeyi kendin planlama, bana bolca soru sor").
- Be critical, not agreeable: say what is wrong or unnecessary, cover edge cases (cancel, refund, partial). Keep scope minimal; no extras (AI, auto-fill, templates) unless asked.
- Once a roadmap is agreed, commit each phase after lint/build/screenshot and continue without asking ("onay almadan commit edip adımları ilerlet"). Stop only for new product decisions.
- Discuss the architecture first; write plans, docs or commits only after the user agrees ("plan yapmadan önce mimariyi konuşmamız gerekiyordu"). Keep solutions simple.
- The owner is a professional who knows accounting; the old "lazy non-technical user" rule is dropped.

**Why:** Past drift came from deciding alone and from over-scoping.
**How to apply:** Follow when planning or finishing phases. See [[feedback-doc-system]].
