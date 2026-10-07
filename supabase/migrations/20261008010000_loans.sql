-- Kredi (ihtiyaç finansmanı). Karar 2026-10-07: toplam geri ödeme kredi günü borç olur.
-- Taksit takvimi kayıt değil, gösterimdir; her gerçek taksit bir aktarımdır (hesap → kredi hesabı).
CREATE TABLE loan_settings (
    account_id         uuid PRIMARY KEY REFERENCES accounts(id),
    group_id           uuid NOT NULL REFERENCES groups(id),
    lender_contact_id  uuid,
    principal          bigint NOT NULL CHECK (principal > 0),          -- anlaşılan tutar
    total_repayment    bigint NOT NULL CHECK (total_repayment > 0),    -- toplam geri ödeme (borç)
    installment_count  smallint NOT NULL CHECK (installment_count BETWEEN 1 AND 120),
    installment_amount bigint NOT NULL CHECK (installment_amount > 0),
    first_due_date     date NOT NULL,
    source_entry_id    uuid REFERENCES journal_entries(id),
    created_at         timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (lender_contact_id, group_id) REFERENCES contacts(id, group_id)
);
CREATE INDEX loan_settings_group_idx ON loan_settings (group_id);
CREATE INDEX loan_settings_lender_idx ON loan_settings (lender_contact_id, group_id);
CREATE INDEX loan_settings_source_idx ON loan_settings (source_entry_id);

ALTER TABLE loan_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_settings_select ON loan_settings FOR SELECT TO authenticated USING ((SELECT is_group_member(group_id)));
GRANT SELECT ON loan_settings TO authenticated;
CREATE TRIGGER loan_settings_audit AFTER INSERT OR UPDATE OR DELETE ON loan_settings
    FOR EACH ROW EXECUTE FUNCTION audit_row();

-- Sıradaki taksit: ödenen = toplam − kalan borç; ödenen taksit sayısı = ödenen / taksit tutarı.
-- due_amount: sıradaki taksitten kalan (kısmi ödeme düşülür), kalan borçla sınırlı.
CREATE VIEW loan_due_status WITH (security_invoker = true) AS
WITH b AS (
    SELECT ls.*, a.name, a.owner_member_id AS member_id,
           COALESCE((SELECT SUM(CASE WHEN l.direction = 'credit' THEN l.base_amount ELSE -l.base_amount END)
                     FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
                     WHERE l.account_id = ls.account_id AND e.deleted_at IS NULL), 0)::bigint AS current_debt
    FROM loan_settings ls JOIN accounts a ON a.id = ls.account_id
    WHERE a.archived_at IS NULL
), p AS (
    SELECT b.*, greatest(b.total_repayment - b.current_debt, 0) AS paid FROM b
)
SELECT p.account_id, p.group_id, p.member_id, p.name, p.installment_count, p.installment_amount, p.total_repayment,
       p.current_debt, p.paid,
       least(p.paid / p.installment_amount, p.installment_count)::int AS paid_count,
       (p.first_due_date + make_interval(months => (p.paid / p.installment_amount)::int))::date AS next_due_date,
       least((p.paid / p.installment_amount + 1) * p.installment_amount - p.paid, p.current_debt)::bigint AS due_amount
FROM p;
GRANT SELECT ON loan_due_status TO authenticated;
