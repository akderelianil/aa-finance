---
owner: backend-engineer
status: active
---

# Ledger model

How the ledger is stored. Product decisions: [ARCHITECTURE](../../ARCHITECTURE.md).

## GnuCash mapping
| GnuCash | aa-finance |
|---|---|
| `transactions` | `entries` |
| `splits` | `lines` |
| split `quantity` (account commodity) | `amount` (account currency) |
| split `value` (transaction currency) | `base_amount` (base currency) |
| `accounts.placeholder` | `accounts.is_placeholder` |
| `accounts.parent_guid` | `accounts.parent_id` |
| account `code` | `accounts.code` (hidden in the UI, orders the tree) |
| account commodity | `accounts.currency_id` (every account) |

Amounts are signed: plus is debit, minus is credit. Rules the database enforces for every writer: [local-first](rules.md). A receipt with several categories is one entry with one line per category.

## Account template
`src/core/chart.ts` is the single source of the starting chart. `setup()` applies it once.

| Part | Content |
|---|---|
| Roots (locked) | Varlık, Borç, Özkaynak, Gelir, Gider. |
| Asset groups (locked) | Nakit, Banka, Yatırım, Duran Varlıklar, and the single account Kişilerden Alacaklar. |
| Debt groups (locked) | Kredi Kartları, Krediler, and the single account Kişilere Borçlar. |
| System accounts (locked) | Açılış Bakiyesi, Kambiyo Kâr/Zararları, Banka Ücreti. |
| Starter (free) | Cüzdan under Nakit, in both options. |
| Recommended (free) | About 40 income and expense categories, named in the setup language. Optional at setup. |

- A locked account keeps its name, parent, type, group flag and archive state, and cannot be deleted. Its UI name comes from i18n by `system_key`.
- Code that posts to a fixed account finds it by `system_key`, never by name or code.
- The New Account dialog asks for name, group and currency. Code and type follow from the group.

## Multi-currency
- Every account has one currency. The base currency is chosen at setup and never changes.
- Each line: `amount` + `base_amount` + `rate`. Rates are manual (Exchange Rates page).
- A foreign line takes its base amount from a given `rate`, else a given `baseAmount`, else the stored rate on or before the entry date. A rounding gap of up to one minor unit per converted line goes to FX Gains and Losses.
