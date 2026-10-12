-- Rehber on the ledger core: every contact (individual, brand, business) can suggest a default income account
-- and a default expense account. Quick transactions fill them in and tag the entry lines with the contact.
-- contacts.default_category_id stays for the hidden flows only.

ALTER TABLE contacts ADD COLUMN default_income_account_id uuid REFERENCES accounts(id);
ALTER TABLE contacts ADD COLUMN default_expense_account_id uuid REFERENCES accounts(id);
CREATE INDEX contacts_default_income_idx ON contacts (default_income_account_id);
CREATE INDEX contacts_default_expense_idx ON contacts (default_expense_account_id);

UPDATE contacts c SET default_expense_account_id = a.id
FROM accounts a WHERE a.id = c.default_category_id AND a.type = 'expense';
UPDATE contacts c SET default_income_account_id = a.id
FROM accounts a WHERE a.id = c.default_category_id AND a.type = 'income';

-- Open receivable / payable per contact for the whole group (one shared ledger), in the base currency.
-- Positive: the contact owes the group. Negative: the group owes the contact.
CREATE VIEW contact_ledger_balances WITH (security_invoker = true) AS
SELECT l.contact_id,
       SUM(CASE WHEN l.direction = 'debit' THEN l.base_amount ELSE -l.base_amount END)::bigint AS net_base_amount
FROM journal_lines l
JOIN journal_entries e ON e.id = l.entry_id
JOIN accounts a ON a.id = l.account_id
WHERE e.deleted_at IS NULL AND l.contact_id IS NOT NULL AND a.subtype IN ('receivable', 'payable')
GROUP BY l.contact_id;

GRANT SELECT ON contact_ledger_balances TO authenticated;
