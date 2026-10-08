-- Open debt per contact and side, base currency. receivable: positive = the contact owes the group.
-- payable: positive = the group owes the contact. Quick Entry Borç shows it and warns on overpayment.
CREATE VIEW contact_debt_balances WITH (security_invoker = true) AS
SELECT l.contact_id, a.subtype,
       SUM(CASE WHEN (a.subtype = 'receivable') = (l.direction = 'debit') THEN l.base_amount ELSE -l.base_amount END)::bigint AS open_base_amount
FROM journal_lines l
JOIN journal_entries e ON e.id = l.entry_id
JOIN accounts a ON a.id = l.account_id
WHERE e.deleted_at IS NULL AND l.contact_id IS NOT NULL AND a.subtype IN ('receivable', 'payable')
GROUP BY l.contact_id, a.subtype;

GRANT SELECT ON contact_debt_balances TO authenticated;
