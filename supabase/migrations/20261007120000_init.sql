-- aa-finance çekirdek şema (PostgreSQL). TASLAK v2 — birlikte gözden geçiriliyor.
-- Kurallar:
--  * Tutarlar minor unit (kuruş/cent) bigint. Float yok.
--  * ID'ler UUID v7; uygulama (Go) üretir, DB default'u yok.
--  * Ortak hesap yok: bilanço hesaplarının (varlık/borç/özkaynak) tek sahibi var.
--    Gelir/gider hesapları (kategoriler) grup seviyesindedir ve para biriminden bağımsızdır.
--  * Her yevmiye kaydı tek üyeye aittir; kayıttaki tüm bilanço hesapları o üyenin hesaplarıdır.
--  * Kayıtlar düzenlenebilir; tüm değişiklikler audit_log'a (DB trigger) yazılır. Silme = soft delete.

CREATE TABLE currencies (
    code     char(3) PRIMARY KEY,           -- ISO 4217
    exponent smallint NOT NULL DEFAULT 2,
    name     text NOT NULL
);

-- Giriş bilgileri Supabase Auth'ta (auth.users). Burada sadece profil tutulur.
CREATE TABLE profiles (
    id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1)));
    RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TABLE groups (
    id            uuid PRIMARY KEY,
    name          text NOT NULL,
    base_currency char(3) NOT NULL REFERENCES currencies(code),
    lock_date     date,                      -- bu tarihe (dahil) kadar kayıtlar düzenlenemez; NULL = kilit yok
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE members (
    id         uuid PRIMARY KEY,
    group_id   uuid NOT NULL REFERENCES groups(id),
    user_id    uuid NOT NULL REFERENCES profiles(id),
    role       text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, user_id),
    UNIQUE (id, group_id)
);

-- Yatırım enstrümanları (grup seviyesinde ortak katalog). Döviz enstrüman DEĞİLDİR:
-- USD/EUR hesapları normal çok para birimli hesaplardır. Altın/gümüş/petrol 'commodity',
-- fiyat enstrümanın kendi para biriminde (örn. gram altın = TRY, AAPL = USD).
CREATE TABLE instruments (
    id         uuid PRIMARY KEY,
    group_id   uuid NOT NULL REFERENCES groups(id),
    kind       text NOT NULL CHECK (kind IN ('crypto', 'commodity', 'stock', 'fund', 'bond')),
    symbol     text NOT NULL,                      -- BTC, XAU-GR, AAPL, THYAO, TGE ...
    name       text NOT NULL,
    market     text,                               -- BIST, NASDAQ, NYSE, TEFAS ...
    currency   char(3) NOT NULL REFERENCES currencies(code),  -- fiyat para birimi
    unit       text NOT NULL DEFAULT 'adet',       -- adet, gram, ons, nominal ...
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_id, kind, market, symbol),
    UNIQUE (id, group_id)
);

-- Manuel fiyat girişi. Son fiyat değerleme için öneri olarak gelir.
CREATE TABLE instrument_prices (
    instrument_id uuid NOT NULL REFERENCES instruments(id),
    price_date    date NOT NULL,
    price         numeric(28,10) NOT NULL CHECK (price > 0),
    PRIMARY KEY (instrument_id, price_date)
);

-- Hesap planı.
--  * Bilanço hesapları (asset/liability/equity): owner_member_id ZORUNLU, currency ZORUNLU.
--  * Kategoriler (income/expense): owner_member_id NULL (grup), currency NULL (her para birimi).
--  * parent_id ile sınırsız derinlikte ağaç; üst ve alt aynı grup ve aynı tipte olmalı.
CREATE TABLE accounts (
    id              uuid PRIMARY KEY,
    group_id        uuid NOT NULL REFERENCES groups(id),
    owner_member_id uuid REFERENCES members(id),
    parent_id       uuid REFERENCES accounts(id),
    type            text NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
    subtype         text CHECK (subtype IN
                        ('cash', 'bank', 'credit_card', 'investment', 'receivable', 'payable', 'loan', 'other')),
    name            text NOT NULL,
    currency        char(3) REFERENCES currencies(code),
    -- Sistem hesapları (otomatik oluşur): 'fx_gain_loss', 'investment_gain_loss' (kategori, grup geneli),
    -- 'opening_balance' (özkaynak, üye başına, ana para biriminde).
    system_key      text CHECK (system_key IN ('fx_gain_loss', 'investment_gain_loss', 'opening_balance')),
    -- Yatırım hesabı: üye başına enstrüman başına bir hesap, otomatik açılır; para birimi = enstrüman para birimi.
    instrument_id   uuid REFERENCES instruments(id),
    is_placeholder  boolean NOT NULL DEFAULT false,   -- sadece gruplama için; kayıt atılamaz
    archived_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT accounts_instrument_chk CHECK (instrument_id IS NULL OR subtype = 'investment'),
    CONSTRAINT accounts_scope_chk CHECK (
        (type IN ('asset', 'liability', 'equity') AND owner_member_id IS NOT NULL AND currency IS NOT NULL)
     OR (type IN ('income', 'expense')            AND owner_member_id IS NULL     AND currency IS NULL)
    ),
    CONSTRAINT accounts_subtype_chk CHECK (
        subtype IS NULL
     OR (subtype IN ('cash', 'bank', 'investment', 'receivable') AND type = 'asset')
     OR (subtype IN ('credit_card', 'payable', 'loan')          AND type = 'liability')
     OR (subtype = 'other' AND type IN ('asset', 'liability'))
    ),
    UNIQUE (id, group_id)
);
CREATE UNIQUE INDEX accounts_system_unique ON accounts(group_id, owner_member_id, system_key) NULLS NOT DISTINCT
    WHERE system_key IS NOT NULL;
CREATE UNIQUE INDEX accounts_instrument_unique ON accounts(owner_member_id, instrument_id)
    WHERE instrument_id IS NOT NULL;
CREATE INDEX accounts_group_idx  ON accounts(group_id);
CREATE INDEX accounts_parent_idx ON accounts(parent_id);

-- Kredi kartına özel ayarlar (opsiyonel).
CREATE TABLE credit_card_settings (
    account_id      uuid PRIMARY KEY REFERENCES accounts(id),
    credit_limit    bigint CHECK (credit_limit >= 0),
    statement_day   smallint CHECK (statement_day BETWEEN 1 AND 31),  -- hesap kesim günü
    due_day         smallint CHECK (due_day BETWEEN 1 AND 31)         -- son ödeme günü
);

-- Kişiler: grup rehberi. Bireysel / ticari. Üye bazlı notlar ayrı tabloda.
CREATE TABLE contacts (
    id         uuid PRIMARY KEY,
    group_id   uuid NOT NULL REFERENCES groups(id),
    kind       text NOT NULL DEFAULT 'individual' CHECK (kind IN ('individual', 'business')),
    name       text NOT NULL,
    phone      text,
    tax_id     text,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, group_id)
);

CREATE TABLE member_contact_notes (
    member_id  uuid NOT NULL REFERENCES members(id),
    contact_id uuid NOT NULL REFERENCES contacts(id),
    note       text NOT NULL,
    PRIMARY KEY (member_id, contact_id)
);

-- Yevmiye kaydı. Tek üyeye ait (member_id); created_by = girişi yapan (genelde aynı).
-- Düzenleme/silme yetkisi: yalnızca member_id (uygulama katmanında).
CREATE TABLE journal_entries (
    id           uuid PRIMARY KEY,
    group_id     uuid NOT NULL REFERENCES groups(id),
    member_id    uuid NOT NULL REFERENCES members(id),
    created_by   uuid NOT NULL REFERENCES members(id),
    entry_date   date NOT NULL,
    description  text NOT NULL DEFAULT '',
    is_estimated boolean NOT NULL DEFAULT false,  -- true: TRY karşılığı tahmini (yurt dışı kart harcaması), sonra kesinleştirilir
    source_type  text,                            -- 'installment', 'fx_revaluation', 'loan', ...
    source_id    uuid,
    deleted_at   timestamptz,
    deleted_by   uuid REFERENCES members(id),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (member_id, group_id) REFERENCES members(id, group_id)
);
CREATE INDEX journal_entries_group_date_idx  ON journal_entries(group_id, entry_date) WHERE deleted_at IS NULL;
CREATE INDEX journal_entries_member_date_idx ON journal_entries(member_id, entry_date) WHERE deleted_at IS NULL;

CREATE TABLE journal_lines (
    id          uuid PRIMARY KEY,
    entry_id    uuid NOT NULL REFERENCES journal_entries(id),
    account_id  uuid NOT NULL REFERENCES accounts(id),
    contact_id  uuid REFERENCES contacts(id),            -- borç/alacak için kişi etiketi
    direction   text NOT NULL CHECK (direction IN ('debit', 'credit')),
    amount      bigint NOT NULL CHECK (amount > 0),      -- satırın para biriminde (minor unit)
    currency    char(3) NOT NULL REFERENCES currencies(code),
    base_amount bigint NOT NULL CHECK (base_amount > 0), -- grup ana para biriminde (denge bu kolonla kontrol edilir)
    fx_rate     numeric(24,10) NOT NULL DEFAULT 1 CHECK (fx_rate > 0),
    memo        text,
    position    smallint NOT NULL DEFAULT 0
);
CREATE INDEX journal_lines_entry_idx   ON journal_lines(entry_id);
CREATE INDEX journal_lines_account_idx ON journal_lines(account_id);
CREATE INDEX journal_lines_contact_idx ON journal_lines(contact_id) WHERE contact_id IS NOT NULL;

-- Çift taraflı kayıt kuralı: her kayıtta >=2 satır ve toplam borç = toplam alacak (base_amount).
-- Transaction sonunda kontrol edilir; satır güncelleme/silme/ekleme hepsini kapsar.
CREATE FUNCTION check_entry_balanced() RETURNS trigger AS $$
DECLARE
    eid uuid; d bigint; c bigint; n int;
BEGIN
    IF TG_TABLE_NAME = 'journal_entries' THEN
        eid := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        eid := OLD.entry_id;
    ELSE
        eid := NEW.entry_id;
    END IF;

    SELECT COALESCE(SUM(base_amount) FILTER (WHERE direction = 'debit'), 0),
           COALESCE(SUM(base_amount) FILTER (WHERE direction = 'credit'), 0),
           COUNT(*)
      INTO d, c, n
      FROM journal_lines WHERE entry_id = eid;

    IF n < 2 OR d <> c THEN
        RAISE EXCEPTION 'journal entry % is not balanced (debit=%, credit=%, lines=%)', eid, d, c, n;
    END IF;
    RETURN NULL;
END $$ LANGUAGE plpgsql SET search_path = public;

CREATE CONSTRAINT TRIGGER journal_lines_balanced
    AFTER INSERT OR UPDATE OR DELETE ON journal_lines
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_entry_balanced();

CREATE CONSTRAINT TRIGGER journal_entries_have_lines
    AFTER INSERT ON journal_entries
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_entry_balanced();

-- Taksitli alışveriş. Muhasebe: alışveriş günü tam tutar gider (Borç: gider, Alacak: kart);
-- taksit ödemeleri kart borcunu azaltır (Borç: kart, Alacak: banka/nakit).
-- Plan, alışveriş kaydına (purchase_entry_id) bağlıdır; taksit satırları beklenen ödemelerdir.
CREATE TABLE installment_plans (
    id                uuid PRIMARY KEY,
    group_id          uuid NOT NULL REFERENCES groups(id),
    member_id         uuid NOT NULL REFERENCES members(id),
    purchase_entry_id uuid NOT NULL REFERENCES journal_entries(id),
    card_account_id   uuid NOT NULL REFERENCES accounts(id),
    description       text NOT NULL DEFAULT '',
    total_amount      bigint NOT NULL CHECK (total_amount > 0),
    currency          char(3) NOT NULL REFERENCES currencies(code),
    installment_count smallint NOT NULL CHECK (installment_count > 1),
    first_due_date    date NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE installments (
    id               uuid PRIMARY KEY,
    plan_id          uuid NOT NULL REFERENCES installment_plans(id),
    seq              smallint NOT NULL CHECK (seq > 0),
    due_date         date NOT NULL,
    amount           bigint NOT NULL CHECK (amount > 0),
    payment_entry_id uuid REFERENCES journal_entries(id),   -- ödenince ilgili kayıt
    UNIQUE (plan_id, seq)
);
CREATE INDEX installments_due_idx ON installments(due_date) WHERE payment_entry_id IS NULL;

-- Yatırım alım/satımları (adet bilgisi). Parasal etki yevmiye kaydındadır (entry_id).
-- Alım : Borç yatırım hesabı (enstrüman para biriminde), Alacak ödeme hesabı.
-- Satım: Borç tahsilat hesabı, Alacak yatırım hesabı (defter değeri, adetle orantılı);
--        fark 'investment_gain_loss' kategorisine otomatik yazılır.
-- Dönem değerlemesi: Borç/Alacak yatırım hesabı, karşılığı 'investment_gain_loss' (source_type='valuation').
CREATE TABLE investment_trades (
    id            uuid PRIMARY KEY,
    entry_id      uuid NOT NULL REFERENCES journal_entries(id),
    account_id    uuid NOT NULL REFERENCES accounts(id),
    instrument_id uuid NOT NULL REFERENCES instruments(id),
    side          text NOT NULL CHECK (side IN ('buy', 'sell')),
    quantity      numeric(28,10) NOT NULL CHECK (quantity > 0),
    price         numeric(28,10) NOT NULL CHECK (price > 0),   -- enstrüman para biriminde birim fiyat
    fee           bigint NOT NULL DEFAULT 0 CHECK (fee >= 0)   -- komisyon (enstrüman para biriminde, minor unit)
);
CREATE INDEX investment_trades_account_idx ON investment_trades(account_id);

-- Fiş/fatura ekleri (kullanıcı isterse). Dosya diskte/nesne depolamada; DB'de sadece referans.
CREATE TABLE attachments (
    id          uuid PRIMARY KEY,
    group_id    uuid NOT NULL REFERENCES groups(id),
    entry_id    uuid NOT NULL REFERENCES journal_entries(id),
    uploaded_by uuid NOT NULL REFERENCES members(id),
    filename    text NOT NULL,
    mime_type   text NOT NULL,
    size_bytes  bigint NOT NULL CHECK (size_bytes > 0),
    storage_key text NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachments_entry_idx ON attachments(entry_id);

-- Kurlar. Son kullanılan kur "öneri" olarak buradan okunur; döviz işlemlerinde otomatik eklenir.
CREATE TABLE fx_rates (
    id        uuid PRIMARY KEY,
    group_id  uuid NOT NULL REFERENCES groups(id),
    base      char(3) NOT NULL REFERENCES currencies(code),   -- 1 base = rate quote
    quote     char(3) NOT NULL REFERENCES currencies(code),
    rate_date date NOT NULL,
    rate      numeric(24,10) NOT NULL CHECK (rate > 0),
    UNIQUE (group_id, base, quote, rate_date)
);

-- Denetim logu: tek genel tablo. Actor, uygulamanın her transaction başında set ettiği
-- `app.member_id` oturum değişkeninden okunur (SET LOCAL app.member_id = '<uuid>').
CREATE TABLE audit_log (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    at         timestamptz NOT NULL DEFAULT now(),
    table_name text NOT NULL,
    record_id  uuid,
    group_id   uuid,
    action     text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    actor_id   uuid,
    before     jsonb,
    after      jsonb
);
CREATE INDEX audit_log_record_idx ON audit_log(table_name, record_id);
CREATE INDEX audit_log_group_idx  ON audit_log(group_id, at);

CREATE FUNCTION audit_row() RETURNS trigger AS $$
DECLARE
    b jsonb; a jsonb; src jsonb; actor uuid;
BEGIN
    BEGIN
        actor := NULLIF(current_setting('app.member_id', true), '')::uuid;
    EXCEPTION WHEN others THEN
        actor := NULL;
    END;

    IF TG_OP = 'INSERT' THEN a := to_jsonb(NEW); src := a;
    ELSIF TG_OP = 'UPDATE' THEN b := to_jsonb(OLD); a := to_jsonb(NEW); src := a;
    ELSE b := to_jsonb(OLD); src := b;
    END IF;

    INSERT INTO audit_log (table_name, record_id, group_id, action, actor_id, before, after)
    VALUES (TG_TABLE_NAME,
            NULLIF(src->>'id', '')::uuid,
            NULLIF(src->>'group_id', '')::uuid,
            lower(TG_OP), actor, b, a);
    RETURN NULL;
END $$ LANGUAGE plpgsql SET search_path = public;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['groups', 'members', 'accounts', 'contacts', 'journal_entries',
                             'journal_lines', 'installment_plans', 'installments', 'instruments',
                             'investment_trades', 'attachments']
    LOOP
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I
                        FOR EACH ROW EXECUTE FUNCTION audit_row()', t || '_audit', t);
    END LOOP;
END $$;


-- ---------------------------------------------------------------------------
-- Güvenlik: RLS. Okuma: grup üyeleri grubun her şeyini görür.
-- Yazma: istemciden HİÇ yazma yok (politika ve yetki yok). Tüm yazmalar Edge Function'lardan,
-- sunucu tarafı Postgres bağlantısıyla yapılır; sahiplik kuralları orada doğrulanır.
-- ---------------------------------------------------------------------------
CREATE FUNCTION is_group_member(gid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM members WHERE group_id = gid AND user_id = auth.uid());
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION is_group_member(uuid) FROM anon;

-- +group_id olan tablolar
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['members', 'accounts', 'contacts', 'journal_entries', 'installment_plans',
                             'instruments', 'attachments', 'fx_rates', 'audit_log']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (is_group_member(group_id))',
                       t || '_select', t);
    END LOOP;
END $$;

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY groups_select ON groups FOR SELECT TO authenticated USING (is_group_member(id));

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM members a JOIN members b ON a.group_id = b.group_id
               WHERE a.user_id = auth.uid() AND b.user_id = profiles.id)
);

ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY currencies_select ON currencies FOR SELECT TO authenticated USING (true);

-- Üst kayda bağlı tablolar
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY journal_lines_select ON journal_lines FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = entry_id AND is_group_member(e.group_id)));

ALTER TABLE investment_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY investment_trades_select ON investment_trades FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = entry_id AND is_group_member(e.group_id)));

ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY installments_select ON installments FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM installment_plans p WHERE p.id = plan_id AND is_group_member(p.group_id)));

ALTER TABLE instrument_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY instrument_prices_select ON instrument_prices FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM instruments i WHERE i.id = instrument_id AND is_group_member(i.group_id)));

ALTER TABLE credit_card_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_card_settings_select ON credit_card_settings FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM accounts a WHERE a.id = account_id AND is_group_member(a.group_id)));

ALTER TABLE member_contact_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_contact_notes_select ON member_contact_notes FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_id AND is_group_member(c.group_id)));

-- Başlangıç para birimleri (yenisi migration ile eklenir).
INSERT INTO currencies (code, exponent, name) VALUES
    ('TRY', 2, 'Türk Lirası'),
    ('USD', 2, 'ABD Doları'),
    ('EUR', 2, 'Euro'),
    ('GBP', 2, 'İngiliz Sterlini'),
    ('CHF', 2, 'İsviçre Frankı');
