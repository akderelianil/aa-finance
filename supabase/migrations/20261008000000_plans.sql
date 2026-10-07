-- Plan / Yaklaşanlar: kayıt değil, gösterim. Gerçek bir kayıt girilince kendiliğinden kapanır.

-- Ayın d. günü; ay kısaysa son günü.
CREATE FUNCTION month_day(m date, d int) RETURNS date
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
    SELECT (date_trunc('month', m)::date
            + (least(d, extract(day FROM date_trunc('month', m) + interval '1 month - 1 day')::int) - 1));
$$;

-- Kredi kartı son ödeme durumu (kesim ve son ödeme günü girilmiş kartlar).
-- statement_date: bugün ya da önceki son kesim · due_date: kesimden sonraki ilk son ödeme günü.
-- statement_debt: kesim günündeki borç · paid_since: kesimden sonra karta yapılan ödemeler (borç yönlü satırlar).
CREATE VIEW card_due_status WITH (security_invoker = true) AS
WITH s AS (
    SELECT a.id AS account_id, a.group_id, a.owner_member_id AS member_id, a.name, cs.statement_day, cs.due_day,
           CASE WHEN month_day(current_date, cs.statement_day) <= current_date
                THEN month_day(current_date, cs.statement_day)
                ELSE month_day((current_date - interval '1 month')::date, cs.statement_day) END AS statement_date
    FROM accounts a
    JOIN credit_card_settings cs ON cs.account_id = a.id
    WHERE a.subtype = 'credit_card' AND a.archived_at IS NULL
      AND cs.statement_day IS NOT NULL AND cs.due_day IS NOT NULL
), d AS (
    SELECT s.*,
           CASE WHEN month_day(statement_date, due_day) > statement_date
                THEN month_day(statement_date, due_day)
                ELSE month_day((statement_date + interval '1 month')::date, due_day) END AS due_date
    FROM s
)
SELECT d.*,
       COALESCE((SELECT SUM(CASE WHEN l.direction = 'credit' THEN l.base_amount ELSE -l.base_amount END)
                 FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
                 WHERE l.account_id = d.account_id AND e.deleted_at IS NULL AND e.entry_date <= d.statement_date), 0)::bigint
           AS statement_debt,
       COALESCE((SELECT SUM(l.base_amount)
                 FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
                 WHERE l.account_id = d.account_id AND e.deleted_at IS NULL AND l.direction = 'debit'
                   AND e.entry_date > d.statement_date), 0)::bigint
           AS paid_since,
       COALESCE((SELECT SUM(CASE WHEN l.direction = 'credit' THEN l.base_amount ELSE -l.base_amount END)
                 FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
                 WHERE l.account_id = d.account_id AND e.deleted_at IS NULL), 0)::bigint
           AS current_debt
FROM d;
GRANT SELECT ON card_due_status TO authenticated;

-- Tarihli hatırlatmalar. Şimdilik borç/alacak vadesi; vadeli hesap ve kredi sonraki fazlarda eklenir.
-- Kapanma: kişinin bakiyesi sıfırlanınca gösterimden kalkar (istemci); kullanıcı ertele/vazgeç diyebilir.
CREATE TABLE plans (
    id              uuid PRIMARY KEY,
    group_id        uuid NOT NULL REFERENCES groups(id),
    member_id       uuid NOT NULL REFERENCES members(id),
    kind            text NOT NULL CHECK (kind IN ('debt_due')),
    contact_id      uuid,
    due_date        date NOT NULL,
    note            text,
    status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dismissed')),
    source_entry_id uuid REFERENCES journal_entries(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    closed_at       timestamptz,
    FOREIGN KEY (contact_id, group_id) REFERENCES contacts(id, group_id)
);
CREATE INDEX plans_group_idx ON plans (group_id, status, due_date);
CREATE INDEX plans_member_idx ON plans (member_id);
CREATE INDEX plans_contact_idx ON plans (contact_id, group_id);
CREATE INDEX plans_source_entry_idx ON plans (source_entry_id);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_select ON plans FOR SELECT TO authenticated USING ((SELECT is_group_member(group_id)));
GRANT SELECT ON plans TO authenticated;
CREATE TRIGGER plans_audit AFTER INSERT OR UPDATE OR DELETE ON plans FOR EACH ROW EXECUTE FUNCTION audit_row();
