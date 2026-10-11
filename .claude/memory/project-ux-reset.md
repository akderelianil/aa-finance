---
name: project-ux-reset
description: "2026-10-08 UX reset — old docs/ux deleted; flows rebuilt one scenario at a time, simplest first (Gider, Gelir, Transfer done)"
metadata:
  type: project
---

On 2026-10-08 the user deleted all old UX docs (map, inbox, 19 flows, archive) and restarted `docs/ux/` with one minimal file per topic. Rule: double-entry always; minimum effort for the user; list extras under "Henüz yok" until asked.

Done: `gider.md`, `gelir.md`, `transfer.md`, `borc.md` (index in `docs/ux/README.md`). Shared form shape: Tutar, account(s), optional Rehber, Tarih default today.

Decisions:
- Expense: one payment-account list (Nakit / Banka / Kart); no mode per type. Rehber optional (anonymous shops). Split: enter total first, then Satır ekle; remainder falls on the first line; Fark blocks Kaydet.
- Income: only received (tahsil edilmiş) income, salary entered NET. Split allowed (salary + bonus). Receivables are out.
- Transfer: one form for account-to-account, ATM withdraw/deposit, card payment. Optional Masraf (default account "Banka Ücreti", template_key `bank_fee`) adds an expense line. Card cash advance (source = card) is out.

Next candidate: loan (kredi). Resolved 2026-10-11: template already has "Banka Ücreti" (transfer.md fixed to match); glossary got a Rehber row.

**Why:** the old 19-flow map was too complex.
**How to apply:** add the next flow as a new short file in `docs/ux/`; ask the owner for scenarios first. See [[project-ledger-core-pivot]], [[feedback-working-style]].
