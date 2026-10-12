-- Hesap bakiyeleri (silinmemiş kayıtlar). Pozitif = borç bakiyesi (varlık artışı / gider),
-- negatif = alacak bakiyesi (borç artışı / gelir). RLS, çağıranın yetkisiyle işler (security_invoker).
CREATE VIEW account_balances WITH (security_invoker = true) AS
SELECT l.account_id,
       SUM(CASE WHEN l.direction = 'debit' THEN l.amount ELSE -l.amount END)::bigint           AS net_amount,
       SUM(CASE WHEN l.direction = 'debit' THEN l.base_amount ELSE -l.base_amount END)::bigint AS net_base_amount
FROM journal_lines l
JOIN journal_entries e ON e.id = l.entry_id
WHERE e.deleted_at IS NULL
GROUP BY l.account_id;

GRANT SELECT ON account_balances TO authenticated;
