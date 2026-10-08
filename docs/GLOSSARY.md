---
owner: main
status: active
---

# Glossary

Use these terms only. The Turkish column is the term for UI text (`web/src/i18n/tr.ts`). Users know accounting: use the standard Turkish accounting term (Tek Düzen Hesap Planı, GnuCash Turkish).

The "Do not use" column is machine-checked. `cd web && npm run check:terms` fails on each hit in `tr.ts` strings, except the namespaces of hidden flows (list in `web/scripts/check-terms.mjs`). Each value is a word start, case-insensitive. To add a term, add a row here. To change a term, ask the product owner first.

Allowed phrases (the check skips them): `Kayıt ol`, `Giriş yap`, `Çıkış yap`, `Girişe dön`.

## Ledger

| English | Türkçe (UI) | Do not use | Meaning |
|---|---|---|---|
| Chart of Accounts | Hesap Planı | `hesap ağacı` | The account tree of the group. |
| Account | Hesap | `kategori` | A node in the Chart of Accounts. |
| Account code | Hesap kodu | | Tek Düzen style code, unique in the group (100, 102, 770.01). |
| Account type | Hesap türü | | Varlık · Yabancı Kaynak · Özkaynak · Gelir · Gider. |
| Asset / Liability / Equity | Varlık / Yabancı Kaynak / Özkaynak | | Balance-sheet account types. |
| Income / Expense | Gelir / Gider | | Income-statement account types. |
| Parent / child account | Üst hesap / Alt hesap | | Tree position. |
| Placeholder | Grup hesabı | | Sums its children. Takes no line. |
| Opening balances | Açılış Bakiyeleri | | Equity account for opening balances. |
| General Journal | Yevmiye | | The list of all journal entries by date. |
| Journal entry | Yevmiye kaydı · short: Kayıt | `işlem`, `hareket` | One balanced event: date, description, ≥2 lines. |
| Line (split) | Satır | | One account side of a journal entry. |
| Debit / Credit | Borç / Alacak | `giriş`, `çıkış` | Line columns. |
| Description | Açıklama | | Entry text. |
| Memo | Not | | Line text. |
| Imbalance | Fark | | Debit total − credit total of an unsaved entry. |
| Account Register | Hesap Defteri | `muavin` | One account's lines with the other account and a running balance. |
| Balance | Bakiye | | Debit − credit, shown with the account type's normal sign. |
| Currency / base currency | Para birimi / Ana para birimi | `döviz cinsi` | Every account has one. Reports use the base currency. |
| Exchange rate | Kur | | Line rate to the base currency. |
| Archive | Arşivle | | The account leaves the tree. History stays. |

## Reports

| English | Türkçe | Do not use |
|---|---|---|
| Trial Balance | Mizan | |
| Balance Sheet | Bilanço | |
| Income Statement | Gelir Tablosu | `kâr zarar` |
| Net income | Dönem net kârı / zararı | |

## Group

| English | Türkçe | Meaning |
|---|---|---|
| Group | Aile / topluluk | The people who share the books. |
| Member | Üye | A person in the group. "Sign up": `Kayıt ol`. |
| Owner (account) | Sahibi | Optional member label on an account. |

## Actions

| English | Türkçe |
|---|---|
| Save | Kaydet |
| Cancel | Vazgeç |
| Delete | Sil |
| Edit | Düzenle |
| Add line | Satır ekle |
| Options menu | Seçenekler |

## Engineering terms (code and EN docs only)

| Term | Meaning |
|---|---|
| `journal_entries` / `journal_lines` | GnuCash transactions / splits. |
| `base_amount` | Line amount in the group base currency. Entries balance on it. |
| Minor unit | Money as int64 (kuruş, cent). Never float. |
| `template_key` | Stable id of a template account. Code finds a fixed account by it, never by name. |
| Hidden flow | A convenience flow (quick entry, installment, loan, ...) whose UI is hidden since 2026-10-08. |
