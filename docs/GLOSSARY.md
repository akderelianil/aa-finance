---
owner: main
status: active
---

# Glossary

Use these terms only. The Turkish column is the term for UI text and for `docs/ux/**`. The user never sees accounting terms.

## Product concepts

| English | Türkçe (UI / ux docs) | Meaning |
|---|---|---|
| Movement | Hareket | A real, completed money event. The only thing that becomes a record. |
| Directory | Rehber | Who or where: person, company, brand. |
| Plan | Plan | An expected future event. Display only; not a record. A matching Movement closes it. |
| Upcoming | Yaklaşanlar | The single in-app list of open Plans, by date, overdue first. |
| Quick Entry | Hızlı Kayıt | The "what happened?" entry screen. |
| Wallet | Cüzdan | The single cash account of a member. |
| Group / Member | Grup / Üye | A family and its people. |
| Product owner | Ürün sahibi | The user who defines the product. |
| Narrative | Anlatım | One story the product owner tells about a money process. |
| Flow | Akış (AKS-NNN) | A documented process in `docs/ux/akislar/`. |

## Entry types

| English | Türkçe |
|---|---|
| Income / Expense / Transfer | Gelir / Gider / Transfer |
| Debt: borrowed / lent / settle | Borç: Aldım / Verdim / Ödeşme |
| Split | Paylaştır |
| Installment | Taksit |
| Cash advance | Nakit avans |
| Loan | Kredi |
| Time deposit | Vadeli hesap |
| Custody investment | Emanet yatırım |

## Exception patterns

| English | Türkçe | Use when |
|---|---|---|
| Undo | Geri Al | "I tapped wrong just now." |
| Correct | Düzelt | Event is right, a field is wrong. |
| Refund | İade | Money really came back (reverse Movement). |
| Difference | Fark | Bank paid or charged a different amount; the gap is income or expense. |
| Partial | Kısmi | Only part of the amount happened; the rest stays open in the Plan. |
| Closure | Kapanış | End of a Plan: completed, waived or overdue. |

## Engineering terms (code and EN docs only)

| Term | Meaning |
|---|---|
| Journal entry | DB record of a Movement (`journal_entries`), ≥2 lines, debit = credit. |
| Line | One side of a journal entry (`journal_lines`). |
| `base_amount` | Line amount in the group base currency. |
| Minor unit | Money as int64 (kuruş, cent). Never float. |
| Template category | A category from the account template; code finds it by `template_key`, not by name. |
