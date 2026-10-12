---
owner: main
status: active
---

# Glossary

Use these terms only. The Turkish column is the term for UI text (`src/ui/i18n/tr.ts`). Users know accounting: use the standard Turkish accounting term (Tek Düzen Hesap Planı, GnuCash Turkish).

The "Do not use" column is machine-checked. `npm run check:terms` fails on each hit in `tr.ts` strings (`scripts/check-terms.mjs`). Each value is a word start, case-insensitive. To add a term, add a row here. To change a term, ask the product owner first.

Allowed phrases (the check skips them): `Kayıt ol`, `Giriş yap`, `Çıkış yap`, `Girişe dön`.

## Ledger

| English | Türkçe (UI) | Do not use | Meaning |
|---|---|---|---|
| Chart of Accounts | Hesap Planı | `hesap ağacı` | The account tree of the group. |
| Account | Hesap | `kategori` | A node in the Chart of Accounts. |
| Account code | Hesap kodu | | Internal sort key, unique in the group (1.02.01). Hidden in the UI. |
| Account type | Hesap türü | | Varlık · Borç · Özkaynak · Gelir · Gider. |
| Asset / Liability / Equity | Varlık / Borç / Özkaynak | `yabancı kaynak` | Balance-sheet account types. |
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
| Directory / contact | Rehber / Kişi, Marka, Firma/Kurum | `müşteri`, `cari` | Person, brand or business linked to lines. Holds default accounts and the open balance. |

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
| Group | Aile / topluluk | The people who share the books. One ledger file. |
| Group name | Aile/topluluk adı | Shown name of the group. Admin edits it. |
| Book settings | Defter ayarları | Language, country, lock date, activity log days, group name. Admin only. |
| Country | Ülke | Sets date and number format. |
| Member | Üye | A person in the group. No sign-in: the app opens with the last member. |
| Member role | Rol: Yönetici · Üye | Yönetici manages members and edits or deletes any entry. Üye edits or deletes own entries. |
| Profile color | Profil rengi | Member avatar color. |
| Account owner / scope | Hesap sahibi / Aile · Kişi · Ortak | | An account may belong to one member. The Aile/Kişi filter on Reports, Yevmiye and Hesap Planı shows all accounts, one member's accounts, or Ortak (no owner). A new account takes its parent's owner. |
| Setup | Kurulum | First-run steps that create the ledger. |
| Chart template | Şablon: Temel · Önerilen | Starting accounts chosen at setup. |
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
| `entries` / `lines` | GnuCash transactions / splits. |
| `base_amount` | Line amount in the base currency. Entries balance on it. |
| Minor unit | Money as a safe integer (kuruş, cent). Never float. |
| `system_key` | Stable id of a locked core account. Code finds a fixed account by it, never by name. |
