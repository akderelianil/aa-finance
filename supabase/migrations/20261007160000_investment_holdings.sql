-- Yatırım hesabı başına eldeki adet (silinmemiş kayıtlardaki alım − satım).
CREATE VIEW investment_holdings WITH (security_invoker = true) AS
SELECT t.account_id,
       t.instrument_id,
       SUM(CASE WHEN t.side = 'buy' THEN t.quantity ELSE -t.quantity END) AS quantity
FROM investment_trades t
JOIN journal_entries e ON e.id = t.entry_id
WHERE e.deleted_at IS NULL
GROUP BY t.account_id, t.instrument_id;

GRANT SELECT ON investment_holdings TO authenticated;
