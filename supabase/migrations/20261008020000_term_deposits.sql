-- Vadeli hesap. Karar 2026-10-07: kullanıcı anapara + yıllık oran + gün girer; beklenen net getiri türetilir
-- (gösterim). Vade sonu gerçek yatan tutar elle girilir; fark gelir ya da gider olur.

ALTER TABLE accounts DROP CONSTRAINT accounts_subtype_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_subtype_check CHECK (subtype IN
    ('cash', 'bank', 'credit_card', 'investment', 'receivable', 'payable', 'loan', 'deposit', 'other'));
ALTER TABLE accounts DROP CONSTRAINT accounts_subtype_chk;
ALTER TABLE accounts ADD CONSTRAINT accounts_subtype_chk CHECK (
    subtype IS NULL
 OR (subtype IN ('cash', 'bank', 'investment', 'receivable', 'deposit') AND type = 'asset')
 OR (subtype IN ('credit_card', 'payable', 'loan')                     AND type = 'liability')
 OR (subtype = 'other' AND type IN ('asset', 'liability'))
);

-- Geçerli dönem. Vade sonu kaydı dönemi değiştirir; önceki dönem `prev` içinde tutulur (Geri Al için).
CREATE TABLE deposit_settings (
    account_id           uuid PRIMARY KEY REFERENCES accounts(id),
    group_id             uuid NOT NULL REFERENCES groups(id),
    principal            bigint NOT NULL CHECK (principal > 0),
    annual_rate          numeric(9,4) NOT NULL CHECK (annual_rate >= 0),     -- yıllık %, ör. 42.5
    days                 smallint NOT NULL CHECK (days BETWEEN 1 AND 3660),
    withholding_rate     numeric(6,3) NOT NULL DEFAULT 0 CHECK (withholding_rate BETWEEN 0 AND 100), -- stopaj %
    start_date           date NOT NULL,
    maturity_date        date NOT NULL,
    return_account_id    uuid REFERENCES accounts(id),                       -- vade sonu dönülecek hesap (isteğe bağlı)
    open_entry_id        uuid REFERENCES journal_entries(id),
    last_settle_entry_id uuid REFERENCES journal_entries(id),
    prev                 jsonb,
    closed_at            timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    CHECK (maturity_date > start_date)
);
CREATE INDEX deposit_settings_group_idx ON deposit_settings (group_id);
CREATE INDEX deposit_settings_return_idx ON deposit_settings (return_account_id);
CREATE INDEX deposit_settings_open_idx ON deposit_settings (open_entry_id);
CREATE INDEX deposit_settings_settle_idx ON deposit_settings (last_settle_entry_id);

ALTER TABLE deposit_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY deposit_settings_select ON deposit_settings FOR SELECT TO authenticated USING ((SELECT is_group_member(group_id)));
GRANT SELECT ON deposit_settings TO authenticated;
CREATE TRIGGER deposit_settings_audit AFTER INSERT OR UPDATE OR DELETE ON deposit_settings
    FOR EACH ROW EXECUTE FUNCTION audit_row();
