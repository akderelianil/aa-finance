---
owner: main
status: active
---

# Glossary

Use these terms only. The Turkish column is the term for UI text (`web/src/i18n/tr.ts`) and for `docs/ux/**`. The user never sees accounting terms.

The "Do not use" column is machine-checked. `cd web && npm run check:terms` fails on each hit in `tr.ts` strings and `docs/ux/**` (not `arsiv/`, not `gelen-kutusu.md`: it keeps the product owner's own words). Each value is a word start, case-insensitive (`kayıt` also catches `kayıtlar`). To add a term, add a row here. To change a term, ask the product owner first.

Allowed phrases (the check skips them): `Kayıt ol`.

## Product concepts

| English | Türkçe (UI / ux docs) | Do not use | Meaning |
|---|---|---|---|
| Transaction (code: Movement) | İşlem | `hareket`, `kayıt`, `kaydı`, `kayda` | A real, completed money event. The only thing that becomes a journal entry. Verb: `Kaydet` / `Kaydedildi`. |
| Quick Entry | Hızlı işlem | | The "what happened?" entry screen. |
| Account | Hesap | `kategori`, `özkaynak` | Every node in the account tree: cash, bank, card, loan, deposit, investment, expense, income. |
| Expense / income account | Gider hesabı / Gelir hesabı | | An account in the expense or income branch. The Quick Entry field label. |
| Parent / child account | Üst hesap / Alt hesap | | Tree position. |
| Group account (placeholder) | Grup | | A tree node that sums its children. It takes no transaction. |
| Opening balances (equity) | Açılış bakiyeleri | | The equity branch. |
| Wallet | Cüzdan | | The single cash account of a member. |
| Family (code: group) | Aile / topluluk | | The people who share the books. Kind: Aile or Topluluk. |
| Member | Üye | | A person in the family. Also "sign up": `Kayıt ol`, "already a member": `Zaten üye misin?`. |
| Directory | Rehber | `şirket`, `kurum` | Who or where. Kinds: Kişi, Marka, Firma. |
| Plan | Bekleyen (item), Yaklaşanlar (list) | `plan` | An expected future event. Display only; not a journal entry. A matching transaction closes it. |
| Name | Ad / Soyad | `isim`, `soyisim` | Person name fields. |
| Details | Ayrıntılar | `detay` | Extra fields behind a toggle. |
| Product owner | Ürün sahibi | | The user who defines the product. |
| Narrative | Anlatım | | One story the product owner tells about a money process. |
| Flow | Akış (AKS-NNN) | | A documented process in `docs/ux/akislar/`. |

## Transaction kinds

| English | Türkçe | Do not use |
|---|---|---|
| Income / Expense | Gelir / Gider | |
| Transfer (between own accounts) | Transfer · button: `Transfer et` | `aktar`, `virman` |
| Debt: borrowed / lent | Borç aldım / Borç verdim | |
| Debt: got paid back / paid back | Tahsil ettim / Borcumu ödedim | `ödeş`, `alacak` |
| Debts page | Borçlar | |
| Split | Paylaştır | |
| Installment | Taksit | |
| Cash advance | Nakit avans | |
| Loan | Kredi | |
| Time deposit | Vadeli hesap | |
| Custody investment | Emanet yatırım | |
| Fee (bank, ATM, broker, loan) | Masraf | `komisyon`, `kesinti` |
| Withholding tax | Stopaj | |

## Totals and reports

| English | Türkçe | Do not use |
|---|---|---|
| Assets / Liabilities | Varlıklar / Borçlar | `sahip olduklarım` |
| Net worth | Net varlık | `net değer` |
| Income − expense | Net | |
| Line columns (debit / credit) | Giriş / Çıkış | |

## Actions

| English | Türkçe | Use when |
|---|---|---|
| Delete | Sil | The item is gone. |
| Remove (archive) | Kaldır | The item leaves the list. History stays. |
| Cancel | Vazgeç | Close a form without saving. |
| Close (plan) | Kapat | The plan is no longer needed. |
| Options menu | Seçenekler | A row's action menu. |

## Exception patterns

| English | Türkçe | Use when |
|---|---|---|
| Undo | Geri al | "I tapped wrong just now." |
| Correct | Düzelt | Event is right, a field is wrong. |
| Refund | İade | Money really came back (reverse transaction). |
| Difference | Fark | Bank paid or charged a different amount; the gap is income or expense. |
| Partial | Kısmi | Only part of the amount happened; the rest stays open in the plan. |
| Closure | Kapanış | End of a plan: completed, closed or overdue. |

## Engineering terms (code and EN docs only)

| Term | Meaning |
|---|---|
| Journal entry | DB record of a transaction (`journal_entries`), ≥2 lines, debit = credit. |
| Line | One side of a journal entry (`journal_lines`). |
| `base_amount` | Line amount in the group base currency. |
| Minor unit | Money as int64 (kuruş, cent). Never float. |
| Template category | A category from the account template; code finds it by `template_key`, not by name. |
