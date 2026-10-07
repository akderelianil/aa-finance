-- Kişi bazlı borç/alacak bakiyesi (üye başına). net_amount: alacak hesabında pozitif = kişi bana borçlu,
-- borç hesabında negatif = ben kişiye borçluyum. Silinmiş kayıtlar hariç.
CREATE VIEW contact_balances WITH (security_invoker = true) AS
SELECT a.owner_member_id AS member_id,
       l.contact_id,
       a.subtype,
       SUM(CASE WHEN l.direction = 'debit' THEN l.base_amount ELSE -l.base_amount END)::bigint AS net_base_amount
FROM journal_lines l
JOIN journal_entries e ON e.id = l.entry_id
JOIN accounts a ON a.id = l.account_id
WHERE e.deleted_at IS NULL AND l.contact_id IS NOT NULL AND a.subtype IN ('receivable', 'payable')
GROUP BY a.owner_member_id, l.contact_id, a.subtype;

GRANT SELECT ON contact_balances TO authenticated;
