# Scenario pack format (v1)

**Status**: accepted by the owner (2026-11-02). Decision record: [ADR-0024](../adr/0024-scenario-format-and-expression-grammar.md). Form behavior: [ux/gider](../product-designer/ux/gider.md), [gelir](../product-designer/ux/gelir.md), [transfer](../product-designer/ux/transfer.md), [borc](../product-designer/ux/borc.md).

A pack is one JSON document. The core loads it, checks every name, type and expression, and refuses the whole pack on the first fault. A loaded scenario turns user inputs into a draft entry; it never writes. Every platform renders the form from `scenario_describe` and never reads the pack itself.

## Pack

```json
{
  "schema": 1,
  "id": "builtin",
  "scenarios": [ ... ],
  "strings": { "tr": { "expense.title": "Gider", ... }, "en": { ... } }
}
```

- `schema` is the format version; the core refuses a version it does not know.
- The core computes a SHA-256 content hash of the pack text; `scenario_list` shows it. Signatures can be added later without a format change.
- Every text a user sees is a key into `strings`; both `tr` and `en` must have every key the pack uses, or the pack does not load.

## Scenario

```json
{
  "id": "expense",
  "title": "expense.title",
  "date": "date",
  "memo": "memo",
  "distinct": [],
  "inputs": [ ... ],
  "checks": [ ... ],
  "lines": [ ... ],
  "preview": "expense.preview"
}
```

Names (`id`, input names, column names, line ids) follow the grammar's `name` rule: `[a-z][a-z0-9_]*`, and are unique in their scenario; a column name may not repeat an input name. `date` names the date input of the entry, `memo` the optional text input that becomes its memo, and `distinct` lists pairs of account inputs that may not be the same account.

## Inputs

Every input has `name`, `type`, `label` (a string key) and `required` (default `true`).

| Type | Value the UI sends | Extra fields | In expressions |
|---|---|---|---|
| `amount` | canonical decimal text | `of`: the account input whose commodity it is in | amount |
| `account` | `{"id": ...}` or `{"new": "name"}` | `kinds` (account kinds allowed); `new` allowed only when `kinds` has one kind; `default_system`: the system account used when the input is empty | not usable |
| `rate` | decimal text | `of`: the account input it values; shown only when that account is not in the base currency | not usable |
| `contact` | `{"id": ...}` or `{"new": "name"}` | none | not usable |
| `choice` | the option id | `options`: id, label key and `values` | its values, as `name.value` |
| `lines` | a list of rows | `columns`: inputs of type `account` and `amount` | `sum(name.column)` |
| `date` | `YYYY-MM-DD` | none; empty means today in the UI | not usable |
| `text` | text | `max` length | not usable |

- An `amount` input may set `default` to another amount input, and `show_if_commodity_differs: [a, b]`: it is asked only when accounts `a` and `b` differ in commodity, and otherwise takes its default (Transfer's "giren tutar").
- An `account` input that receives `{"new": "Market"}` makes the draft list an account to create: that name, the input's one kind, no parent, the base currency. A `contact` input that receives `{"new": "Ahmet"}` makes the draft list a contact to create (kind individual). Saving writes them with the entry (`post_entry` `create_accounts`, `create_contacts`).
- Option `values` are a sign (`"+"` or `"-"`) or a system account key. This is how Borç picks its direction without a conditional.

## Checks

```json
{ "rule": "amount > 0", "field": "amount", "message": "check.amount_positive" }
```

`rule` is a boolean expression. When it is false, the draft returns a field error on `field` with that message. The engine adds these checks by itself, so packs do not repeat them: a required input is empty (`required`), a `rate` is missing for a foreign line (`rate_needed`), and a `distinct` pair names one account (`same_account`), and an account does not fit the input's `kinds` (`account_kind`).

## Lines

```json
{ "id": "pay", "account": "payment", "amount": "amount", "sign": "-", "rate": "payment_rate" }
```

| Field | Meaning |
|---|---|
| `each` | a `lines` input: the line repeats for each row, and the row's columns are names in `account`, `amount` and `when` |
| `account` | an account input or column, or `{"system": "<choice>.<value>" or "<key>", "commodity_of": "<account input>"}` |
| `amount` | an amount expression; the line takes it as is |
| `sign` | `"+"` (debit, the default), `"-"` (credit) or a choice value |
| `convert` | `true`: if the amount is in another commodity than the account, the official `convert` calculator turns it into the account's commodity with the given rates. Without `convert`, a commodity mismatch is a draft error |
| `rate` | the `rate` input for this line when its account is foreign |
| `base_of` | the id of another line whose base value this line takes when its account is foreign and no rate is given (Transfer between two currencies) |
| `contact` | a contact input; the line carries that contact |
| `when` | a boolean expression; the line is left out when it is false (Transfer's optional fee: `fee > 0`) |

- A line whose amount is zero is left out; a draft with fewer than two lines is an error.
- A `system` account with `commodity_of` resolves to the group itself when the commodities match, otherwise to the group's child in that commodity, or to a new child named by the currency code (for example `USD`).
- A foreign line takes its base value from, in order: its `rate` input, then `base_of`. If neither gives one, the draft returns `rate_needed` on the rate input. The ledger then checks the entry as it checks any entry; rounding differences go to the Rounding line as usual.

## The draft (`scenario_draft`)

Input: `{ "scenario": "expense", "inputs": { ... } }`. Output:

```json
{
  "entry": { "date": ..., "memo": ..., "lines": [ ... ], "create_accounts": [ ... ], "create_contacts": [ ... ] },
  "preview": { "key": "expense.preview", "vars": { "amount": "500,00 TL", "from": "Cüzdan", "to": "Market" }, "text": "Cüzdan −500,00 TL → Market +500,00 TL" },
  "errors": []
}
```

- With errors, `entry` and `preview` are null and `errors` lists `{ "field", "code", "text" }`. A pack fault found at draft time (an overflow, a commodity mismatch) is an error with field null, never a panic.
- The `entry` goes unchanged to `post_entry`. The draft picks the ids of the accounts and contacts to create.
- The preview text is built from the pack string in the book's language, with amounts and dates in the book country's format.

## The form (`scenario_describe`)

`scenario_describe(id, language)` returns the inputs in pack order with resolved labels, types, `required`, `kinds`, `of`, options with labels, `columns`, `default` and `show_if_commodity_differs`. It holds no expressions. This shape is part of the API contract (`api/v1/api.json`), so every platform renders the same form.

## Example: Gider

```json
{
  "id": "expense",
  "title": "expense.title",
  "inputs": [
    { "name": "amount", "type": "amount", "of": "payment", "label": "field.amount" },
    { "name": "payment", "type": "account", "kinds": ["asset", "liability"], "label": "field.payment" },
    { "name": "payment_rate", "type": "rate", "of": "payment", "label": "field.rate" },
    { "name": "items", "type": "lines", "label": "field.expense", "columns": [
      { "name": "expense", "type": "account", "kinds": ["expense"], "label": "field.expense" },
      { "name": "part", "type": "amount", "of": "payment", "label": "field.amount" } ] },
    { "name": "expense_rate", "type": "rate", "of": "items.expense", "label": "field.rate" },
    { "name": "date", "type": "date", "label": "field.date" },
    { "name": "memo", "type": "text", "required": false, "max": 200, "label": "field.memo" }
  ],
  "checks": [
    { "rule": "amount > 0", "field": "amount", "message": "check.amount_positive" },
    { "rule": "sum(items.part) = amount", "field": "items", "message": "check.split_remaining" }
  ],
  "lines": [
    { "id": "spend", "each": "items", "account": "expense", "amount": "part", "convert": true, "rate": "expense_rate" },
    { "id": "pay", "account": "payment", "amount": "amount", "sign": "-", "rate": "payment_rate" }
  ],
  "preview": "expense.preview"
}
```

In v1 the expense accounts of one split share one commodity, so one `expense_rate` serves every row; the draft refuses mixed rows. A single-line Gider is a list with one row; the UI shows the list only after **Birden fazla kaleme böl**. Gelir is the same with the signs turned and `kinds: ["asset"]` on the receiving account.

**Transfer**: `from` (asset) and `to` (asset or liability), a `distinct` pair; `amount` of `from`; `amount_in` of `to` with `default: amount` and `show_if_commodity_differs: [from, to]`; an optional `fee` of `from` and a `fee_account` with `default_system: bank_fee`. Lines: `out` (from, `amount`, credit), `in` (to, `amount_in`, `base_of: out`), and when `fee > 0` a second credit on `from` and the fee on `fee_account` (`convert: true`). The fee is its own line on `from`, so `in` takes the base value of the transferred amount only. A card payment is `to` = a liability account. The built-in pack is `crates/core/src/scenario/builtin.json`.

**Borç**: a `direction` choice with four options; each sets `money` (`+` or `-`), `debt` (the opposite sign) and `group` (`receivable` or `payable`). Inputs: `person` (contact), `money` (asset), `amount` of `money`, `date`, `memo`. Lines: the money line, and the debt line on `{"system": "direction.group", "commodity_of": "money"}` with `contact: person`.

## Owner decisions (2026-11-02)
1. A Gider split shares one payment account in v1; each row has an expense account and an amount. A payment account per row may come later.
2. A foreign amount is converted by `convert: true` on the line (the official `convert` calculator), not by a separate derived value.
3. `open_book` opens a locked system expense account `bank_fee` ("Bank fees"); Transfer's fee goes there by default and the user may pick another expense account.
