# Spec: contacts

> Auto-extracted by spec-miner. Last mined: 2026-10-13.
> Source: src/core/api/contacts.ts, src/core/migrations/0008_contacts.sql, 0009_line_contacts.sql
> Last verified: 2026-10-13 (commit 9bc514c)

Scope: the Rehber (directory): individuals, brands and businesses, brand-business links, suggested income and expense accounts, soft delete, and open debt balances per contact. Each block lists `id`, `entities`, `enforced` (file:line) and the exact title of the covering test (`NONE` when no test covers it).

---

### Requirement: Create a contact
- id: CONTACT-001
- entities: Contact
- enforced: API `contacts.create` src/core/api/contacts.ts:85-103; trigger `contacts_insert` src/core/migrations/0008_contacts.sql:44-57
- test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked

`contacts.create` SHALL add an `individual`, `brand` or `business` with a trimmed name, optional suggested accounts and optional partners, in one transaction, and return its id.

#### Scenario: Business with a brand
- **WHEN** a business is created with `partners: [brand]`
- **THEN** the business lists that brand and the brand lists the business

---

### Invariant: Contact names are unique
- id: CONTACT-002
- entities: Contact
- enforced: unique index `contacts_name` on lower(name) src/core/migrations/0008_contacts.sql:22; mapped to `contact_name_taken` src/core/api/errors.ts:18
- test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked

Two live contacts SHALL NOT share a name, ignoring case and kind.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Invariant: Links join a brand and a business only
- id: CONTACT-003
- entities: Contact, BrandBusiness
- enforced: API `checkPartners` src/core/api/contacts.ts:62-70 (`contact_link_kind`); trigger `brand_businesses_insert` src/core/migrations/0008_contacts.sql:86-95
- test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked

A link SHALL join one live brand and one live business; an individual has no links.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Requirement: Replace a contact's partners
- id: CONTACT-004
- entities: Contact, BrandBusiness
- enforced: API `contacts.update` src/core/api/contacts.ts:118-133
- test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked

When `partners` is given, `contacts.update` SHALL make it the whole set of links: missing ones are soft deleted, new ones added, kept ones untouched.

#### Scenario: Narrow the set
- **WHEN** a business linked to Migros and Macrocenter is updated with `partners: [Macrocenter]`
- **THEN** Migros no longer lists that business

---

### Invariant: One live link per pair
- id: CONTACT-005
- entities: BrandBusiness
- enforced: unique index `brand_businesses_pair` src/core/migrations/0008_contacts.sql:37; mapped to `contact_link_exists` src/core/api/errors.ts:19
- test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked

A brand and a business SHALL have at most one live link.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Invariant: Link ends are fixed
- id: CONTACT-006
- entities: BrandBusiness
- enforced: trigger `brand_businesses_update` src/core/migrations/0008_contacts.sql:97-103 (`contact_link_fixed`, `row_deleted`)
- test: NONE

A link's brand and business SHALL never change, and a removed link is final.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Invariant: Contact kind is fixed
- id: CONTACT-007
- entities: Contact
- enforced: trigger `contacts_update` src/core/migrations/0008_contacts.sql:63 (`contact_kind_fixed`)
- test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked

A contact's kind SHALL never change.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Invariant: Suggested accounts take lines
- id: CONTACT-008
- entities: Contact, Account
- enforced: API `checkAccounts` src/core/api/contacts.ts:72-78 (`account_not_found`, `contact_account_type`); triggers `contacts_insert`/`contacts_update` src/core/migrations/0008_contacts.sql:48-55, 64-73
- test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked

A suggested income account SHALL be a live, non-archived, non-placeholder income account, and a suggested expense account the same for expense.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Requirement: Remove a contact
- id: CONTACT-009
- entities: Contact, BrandBusiness
- enforced: API `contacts.delete` src/core/api/contacts.ts:140-144 (`contact_not_found`); trigger `contacts_soft_delete` src/core/migrations/0008_contacts.sql:78-84; `contacts_no_delete` :40
- test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked

`contacts.delete` SHALL soft delete a contact and its live links, free its name, and fail with `contact_not_found` on a second call; a hard DELETE fails with `no_delete`.

#### Scenario: Name reused after removal
- **WHEN** a business is removed and a new business with the same name is created
- **THEN** the create succeeds

---

### Requirement: A contact with lines stays
- id: CONTACT-010
- entities: Contact, Line
- enforced: trigger `contacts_has_lines` src/core/migrations/0009_line_contacts.sql:16-21 (`contact_has_lines`)
- test: contact on a debt line: balances per contact, a used contact cannot be removed, the line keeps it on edit

A contact named on a live line SHALL NOT be removed; once those entries are deleted it can be.

#### Scenario: Remove a used contact
- **WHEN** a contact is on a live payable line and `contacts.delete` is called
- **THEN** it fails with `contact_has_lines`

---

### Invariant: A removed contact is final
- id: CONTACT-011
- entities: Contact
- enforced: trigger `contacts_update` src/core/migrations/0008_contacts.sql:62 (`row_deleted`)
- test: NONE

A soft-deleted contact SHALL NOT be updated again.

> Last verified: 2026-10-13 (commit 9bc514c)

---

### Requirement: Open debts per contact
- id: CONTACT-012
- entities: Contact, Line, Account
- enforced: API `contacts.balances` src/core/api/contacts.ts:39-60
- test: contacts.balances counts debt lines on every depth under Receivables and Payables

`contacts.balances` SHALL sum each contact's live lines on Receivables and Payables (and every account below them) per currency, in the account currency, leave out zero sums, and return a receivable as owed to us and a payable as owed by us, both positive.

#### Scenario: Lend 2000, collect 500, borrow 700
- **WHEN** Ali gets 2000.00 and pays back 500.00, and 700.00 is borrowed from Veli
- **THEN** Ali shows receivable 1500.00 TRY and Veli payable 700.00 TRY

---

### Requirement: Contact list
- id: CONTACT-013
- entities: Contact
- enforced: API `contacts.list` src/core/api/contacts.ts:19-31
- test: contacts: brand <-> business many-to-many, persons link to none, kinds and names are checked

`contacts.list` SHALL return live contacts ordered by name (case-insensitive), each with its suggested accounts and its live partner ids in ascending order.

#### Scenario: A person
- **WHEN** an individual is listed
- **THEN** its partners list is empty

<!-- uncertainty: contacts ops have no role check; any signed-in member can change the Rehber. -->
