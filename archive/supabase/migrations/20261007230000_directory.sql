-- Rehber: kişi (individual) · marka (brand) · firma (business).
-- Ödeme markaya yazılır; firma arka planda (marka ↔ firma çoktan çoğa). Kategori markadan varsayılan gelir.

ALTER TABLE contacts DROP CONSTRAINT contacts_kind_check;
ALTER TABLE contacts ADD CONSTRAINT contacts_kind_check CHECK (kind IN ('individual', 'brand', 'business'));
ALTER TABLE contacts ADD COLUMN default_category_id uuid REFERENCES accounts(id);
ALTER TABLE contacts ADD COLUMN email text;
CREATE INDEX contacts_default_category_idx ON contacts (default_category_id);

-- Mevcut veri: yalnız gider/gelir satırında geçen (hiç borç/alacak satırı olmayan) kişiler markadır.
UPDATE contacts c SET kind = 'brand'
WHERE c.kind = 'individual'
  AND EXISTS (SELECT 1 FROM journal_lines l JOIN accounts a ON a.id = l.account_id
              WHERE l.contact_id = c.id AND a.type IN ('expense', 'income'))
  AND NOT EXISTS (SELECT 1 FROM journal_lines l JOIN accounts a ON a.id = l.account_id
                  WHERE l.contact_id = c.id AND a.subtype IN ('receivable', 'payable'));

-- Markanın varsayılan kategorisi: en çok kullanılan gider kategorisi.
UPDATE contacts c SET default_category_id = (
    SELECT l.account_id FROM journal_lines l
    JOIN accounts a ON a.id = l.account_id
    JOIN journal_entries e ON e.id = l.entry_id
    WHERE l.contact_id = c.id AND a.type = 'expense' AND a.system_key IS NULL AND e.deleted_at IS NULL
    GROUP BY l.account_id ORDER BY count(*) DESC, max(e.entry_date) DESC LIMIT 1)
WHERE c.kind = 'brand';

CREATE TABLE brand_businesses (
    group_id    uuid NOT NULL REFERENCES groups(id),
    brand_id    uuid NOT NULL,
    business_id uuid NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (brand_id, business_id),
    FOREIGN KEY (brand_id, group_id) REFERENCES contacts(id, group_id),
    FOREIGN KEY (business_id, group_id) REFERENCES contacts(id, group_id)
);
CREATE INDEX brand_businesses_business_idx ON brand_businesses (business_id, group_id);
CREATE INDEX brand_businesses_brand_group_idx ON brand_businesses (brand_id, group_id);
CREATE INDEX brand_businesses_group_idx ON brand_businesses (group_id);

-- Banka hesapları (IBAN çoğunlukla kopyalamak için). Kişide ve firmada olabilir.
CREATE TABLE contact_bank_accounts (
    id         uuid PRIMARY KEY,
    group_id   uuid NOT NULL REFERENCES groups(id),
    contact_id uuid NOT NULL,
    bank_name  text,
    iban       text NOT NULL CHECK (length(iban) BETWEEN 10 AND 40),
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (contact_id, group_id) REFERENCES contacts(id, group_id)
);
CREATE INDEX contact_bank_accounts_contact_idx ON contact_bank_accounts (contact_id, group_id);
CREATE INDEX contact_bank_accounts_group_idx ON contact_bank_accounts (group_id);

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['brand_businesses', 'contact_bank_accounts']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING ((SELECT is_group_member(group_id)))',
                       t || '_select', t);
        EXECUTE format('GRANT SELECT ON %I TO authenticated', t);
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I
                        FOR EACH ROW EXECUTE FUNCTION audit_row()', t || '_audit', t);
    END LOOP;
END $$;
