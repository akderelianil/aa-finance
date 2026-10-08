-- Ledger core (GnuCash + Tek Düzen Hesap Planı):
-- * every account has a currency (income/expense get the group base currency);
-- * the owner member is an optional label on every account type, not a posting rule;
-- * every account has a code, unique per group (digits and dots: 1, 10, 100, 100.01, 770.02.01);
-- * the template is a TDHP-style tree: balance-sheet groups (1 Dönen Varlıklar ... 5 Özkaynaklar) and
--   income/expense groups (60, 64, 67, 77, 78). A new account without a parent goes under its default group.

-- 1. Columns and constraints ------------------------------------------------------------------------------

ALTER TABLE accounts DROP CONSTRAINT accounts_scope_chk;
ALTER TABLE accounts DROP CONSTRAINT accounts_template_key_chk;
ALTER TABLE accounts ADD COLUMN code text;
ALTER TABLE accounts ADD CONSTRAINT accounts_code_chk CHECK (code ~ '^[0-9]+(\.[0-9]+)*$' AND length(code) <= 30);
CREATE UNIQUE INDEX accounts_code_unique ON accounts(group_id, code);

-- Parent: same group and type, not a system account, no cycle. Owner and currency can differ (GnuCash).
CREATE OR REPLACE FUNCTION accounts_check_parent() RETURNS trigger AS $$
DECLARE
    p   accounts%ROWTYPE;
    cur uuid;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;
    IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'account cannot be its own parent' USING ERRCODE = '23514';
    END IF;
    SELECT * INTO p FROM accounts WHERE id = NEW.parent_id;
    IF NOT FOUND OR p.group_id <> NEW.group_id OR p.type <> NEW.type OR p.system_key IS NOT NULL THEN
        RAISE EXCEPTION 'invalid parent account' USING ERRCODE = '23514';
    END IF;
    cur := p.parent_id;
    WHILE cur IS NOT NULL LOOP
        IF cur = NEW.id THEN
            RAISE EXCEPTION 'account tree cycle' USING ERRCODE = '23514';
        END IF;
        SELECT parent_id INTO cur FROM accounts WHERE id = cur;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Line rules: no placeholder; same group; the line is in the account currency; a base-currency line has
-- amount = base_amount. The account owner is a label only.
CREATE OR REPLACE FUNCTION journal_lines_check() RETURNS trigger AS $$
DECLARE
    a accounts%ROWTYPE;
    e journal_entries%ROWTYPE;
    base char(3);
BEGIN
    SELECT * INTO a FROM accounts WHERE id = NEW.account_id;
    SELECT * INTO e FROM journal_entries WHERE id = NEW.entry_id;
    SELECT base_currency INTO base FROM groups WHERE id = e.group_id;
    IF a.is_placeholder THEN
        RAISE EXCEPTION 'cannot post to a placeholder account' USING ERRCODE = '23514';
    END IF;
    IF a.group_id <> e.group_id THEN
        RAISE EXCEPTION 'line account is in another group' USING ERRCODE = '23514';
    END IF;
    IF a.currency <> NEW.currency THEN
        RAISE EXCEPTION 'line currency must match the account currency' USING ERRCODE = '23514';
    END IF;
    IF NEW.currency = base AND NEW.amount <> NEW.base_amount THEN
        RAISE EXCEPTION 'base-currency line must have amount = base_amount' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. Defaults: parent group, code ------------------------------------------------------------------------

-- The default group of an account without a parent (template key of the group node).
CREATE FUNCTION account_default_parent(p_group uuid, p_type text, p_subtype text, p_system_key text)
RETURNS uuid AS $$
    SELECT id FROM accounts WHERE group_id = p_group AND template_key = CASE
        WHEN p_system_key IN ('fx_gain_loss', 'investment_gain_loss') THEN 'i64'
        WHEN p_system_key = 'opening_balance' THEN 'b500'
        WHEN p_type = 'asset' THEN CASE p_subtype
            WHEN 'cash' THEN 'b100' WHEN 'bank' THEN 'b102' WHEN 'deposit' THEN 'b102'
            WHEN 'investment' THEN 'b118' WHEN 'receivable' THEN 'b136' ELSE 'b19' END
        WHEN p_type = 'liability' THEN CASE p_subtype
            WHEN 'credit_card' THEN 'b309' WHEN 'loan' THEN 'b300' ELSE 'b336' END
        WHEN p_type = 'equity' THEN 'b500'
        WHEN p_type = 'income' THEN 'i649'
        ELSE 'e770' END;
$$ LANGUAGE sql SET search_path = public;

-- Next free child code. A TDHP group code (no dot, 1-2 digits) takes the first free digit (1 → 12, 10 → 101);
-- else, or when no digit is free, the child gets the first free 2-digit suffix (100 → 100.01, 770.02 → 770.02.01).
CREATE FUNCTION account_next_code(p_parent uuid) RETURNS text AS $$
DECLARE
    pc text;
    g  uuid;
    n  int;
BEGIN
    SELECT code, group_id INTO pc, g FROM accounts WHERE id = p_parent;
    IF pc IS NULL THEN
        RETURN NULL;
    END IF;
    IF pc ~ '^[0-9]{1,2}$' THEN
        SELECT min(d) INTO n FROM generate_series(0, 9) d
        WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE group_id = g AND code = pc || d);
        IF n IS NOT NULL THEN
            RETURN pc || n;
        END IF;
    END IF;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM accounts WHERE group_id = g AND code = pc || '.' || lpad(n::text, 2, '0')) LOOP
        n := n + 1;
    END LOOP;
    RETURN pc || '.' || lpad(n::text, 2, '0');
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE FUNCTION accounts_fill_defaults() RETURNS trigger AS $$
BEGIN
    IF NEW.currency IS NULL THEN
        SELECT base_currency INTO NEW.currency FROM groups WHERE id = NEW.group_id;
    END IF;
    IF NEW.parent_id IS NULL AND NEW.template_key IS NULL THEN
        NEW.parent_id := account_default_parent(NEW.group_id, NEW.type, NEW.subtype, NEW.system_key);
    END IF;
    IF NEW.code IS NULL THEN
        NEW.code := CASE NEW.system_key WHEN 'investment_gain_loss' THEN '645' WHEN 'fx_gain_loss' THEN '646' END;
        IF NEW.code IS NULL OR EXISTS (SELECT 1 FROM accounts WHERE group_id = NEW.group_id AND code = NEW.code) THEN
            NEW.code := account_next_code(NEW.parent_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER accounts_defaults
    BEFORE INSERT ON accounts
    FOR EACH ROW EXECUTE FUNCTION accounts_fill_defaults();

-- 3. Template -------------------------------------------------------------------------------------------

-- Idempotent. A missing node is created with its code. An existing template node without a code (accounts from
-- before this migration) gets the code, name, parent and placeholder flag of the template. An active category
-- with the same name (or an alias) and no key is adopted. Then every account without a code gets its default
-- parent (if it has none) and the next free code.
CREATE OR REPLACE FUNCTION apply_account_template(p_group uuid) RETURNS void AS $$
DECLARE
    r record;
    v_id uuid;
    v_parent uuid;
    v_code text;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            -- (order, key, parent key, type, code, name, placeholder, aliases)
            (  1, 'b1',    NULL,   'asset',     '1',   'Dönen Varlıklar',               true, ARRAY[]::text[]),
            (  2, 'b10',   'b1',   'asset',     '10',  'Hazır Değerler',                true, ARRAY[]::text[]),
            (  3, 'b100',  'b10',  'asset',     '100', 'Kasa',                          true, ARRAY[]::text[]),
            (  4, 'b102',  'b10',  'asset',     '102', 'Bankalar',                      true, ARRAY[]::text[]),
            (  5, 'b11',   'b1',   'asset',     '11',  'Menkul Kıymetler',              true, ARRAY[]::text[]),
            (  6, 'b118',  'b11',  'asset',     '118', 'Diğer Menkul Kıymetler',        true, ARRAY[]::text[]),
            (  7, 'b13',   'b1',   'asset',     '13',  'Diğer Alacaklar',               true, ARRAY[]::text[]),
            (  8, 'b136',  'b13',  'asset',     '136', 'Diğer Çeşitli Alacaklar',       true, ARRAY[]::text[]),
            (  9, 'b19',   'b1',   'asset',     '19',  'Diğer Dönen Varlıklar',         true, ARRAY[]::text[]),
            ( 10, 'b2',    NULL,   'asset',     '2',   'Duran Varlıklar',               true, ARRAY[]::text[]),
            ( 11, 'b25',   'b2',   'asset',     '25',  'Maddi Duran Varlıklar',         true, ARRAY[]::text[]),
            ( 12, 'b252',  'b25',  'asset',     '252', 'Binalar',                       true, ARRAY[]::text[]),
            ( 13, 'b254',  'b25',  'asset',     '254', 'Taşıtlar',                      true, ARRAY[]::text[]),
            ( 14, 'b255',  'b25',  'asset',     '255', 'Demirbaşlar',                   true, ARRAY[]::text[]),
            ( 15, 'b3',    NULL,   'liability', '3',   'Kısa Vadeli Yabancı Kaynaklar', true, ARRAY[]::text[]),
            ( 16, 'b30',   'b3',   'liability', '30',  'Mali Borçlar',                  true, ARRAY[]::text[]),
            ( 17, 'b300',  'b30',  'liability', '300', 'Banka Kredileri',               true, ARRAY[]::text[]),
            ( 18, 'b309',  'b30',  'liability', '309', 'Kredi Kartları',                true, ARRAY[]::text[]),
            ( 19, 'b33',   'b3',   'liability', '33',  'Diğer Borçlar',                 true, ARRAY[]::text[]),
            ( 20, 'b336',  'b33',  'liability', '336', 'Diğer Çeşitli Borçlar',         true, ARRAY[]::text[]),
            ( 21, 'b4',    NULL,   'liability', '4',   'Uzun Vadeli Yabancı Kaynaklar', true, ARRAY[]::text[]),
            ( 22, 'b40',   'b4',   'liability', '40',  'Mali Borçlar',                  true, ARRAY[]::text[]),
            ( 23, 'b400',  'b40',  'liability', '400', 'Banka Kredileri',               true, ARRAY[]::text[]),
            ( 24, 'b5',    NULL,   'equity',    '5',   'Özkaynaklar',                   true, ARRAY[]::text[]),
            ( 25, 'b50',   'b5',   'equity',    '50',  'Ödenmiş Sermaye',               true, ARRAY[]::text[]),
            ( 26, 'b500',  'b50',  'equity',    '500', 'Sermaye',                       true, ARRAY[]::text[]),

            ( 30, 'i60',   NULL,   'income',    '60',  'Ücret Gelirleri',               true,  ARRAY[]::text[]),
            ( 31, 'salary',       'i60', 'income', '600', 'Maaş',                      false, ARRAY[]::text[]),
            ( 32, 'bonus',        'i60', 'income', '601', 'Prim ve İkramiye',          false, ARRAY['Prim', 'İkramiye', 'Prim & İkramiye']),
            ( 33, 'side_income',  'i60', 'income', '602', 'Ek Gelir',                  false, ARRAY[]::text[]),
            ( 34, 'i64',   NULL,   'income',    '64',  'Diğer Olağan Gelir ve Kârlar',  true,  ARRAY[]::text[]),
            ( 35, 'dividend',     'i64', 'income', '640', 'Temettü Gelirleri',         false, ARRAY['Temettü']),
            ( 36, 'deposit_return','i64','income', '642', 'Faiz Gelirleri',            false, ARRAY['Vadeli getiri', 'Faiz', 'Faiz & Vadeli Getiri']),
            ( 37, 'i649',  'i64',  'income',    '649', 'Diğer Olağan Gelirler',         true,  ARRAY[]::text[]),
            ( 38, 'rental_income','i649','income', '649.01', 'Kira Geliri',            false, ARRAY[]::text[]),
            ( 39, 'other_income', 'i649','income', '649.99', 'Diğer Gelirler',         false, ARRAY['Diğer']),
            ( 40, 'i67',   NULL,   'income',    '67',  'Olağandışı Gelir ve Kârlar',    true,  ARRAY[]::text[]),
            ( 41, 'i679',  'i67',  'income',    '679', 'Diğer Olağandışı Gelirler',     true,  ARRAY[]::text[]),
            ( 42, 'allowance',    'i679','income', '679.01', 'Harçlık',                false, ARRAY[]::text[]),
            ( 43, 'gift_received','i679','income', '679.02', 'Hediye',                 false, ARRAY[]::text[]),
            ( 44, 'coupon',       'i679','income', '679.03', 'Kupon ve Hediye Çeki',   false, ARRAY['Kupon', 'Kupon & Hediye Çeki']),

            ( 50, 'e77',   NULL,   'expense',   '77',  'Genel Yönetim Giderleri',       true,  ARRAY[]::text[]),
            ( 51, 'e770',  'e77',  'expense',   '770', 'Genel Giderler',                true,  ARRAY[]::text[]),
            ( 52, 'groceries',        'e770',  'expense', '770.01',    'Market',                   false, ARRAY[]::text[]),
            ( 53, 'food',             'e770',  'expense', '770.02',    'Yeme-İçme',                true,  ARRAY['Yeme İçme', 'Yemek']),
            ( 54, 'restaurant',       'food',  'expense', '770.02.01', 'Restoran',                 false, ARRAY[]::text[]),
            ( 55, 'cafe',             'food',  'expense', '770.02.02', 'Kafe & Kahve',             false, ARRAY['Kahve', 'Kafe']),
            ( 56, 'delivery',         'food',  'expense', '770.02.03', 'Paket Servis',             false, ARRAY[]::text[]),
            ( 57, 'transport',        'e770',  'expense', '770.03',    'Ulaşım',                   true,  ARRAY[]::text[]),
            ( 58, 'public_transport', 'transport', 'expense', '770.03.01', 'Toplu Taşıma',         false, ARRAY[]::text[]),
            ( 59, 'taxi',             'transport', 'expense', '770.03.02', 'Taksi',                false, ARRAY[]::text[]),
            ( 60, 'intercity',        'transport', 'expense', '770.03.03', 'Şehirlerarası Yolculuk', false, ARRAY[]::text[]),
            ( 61, 'vehicle',          'e770',  'expense', '770.04',    'Araç',                     true,  ARRAY['Araba']),
            ( 62, 'fuel',             'vehicle', 'expense', '770.04.01', 'Yakıt',                  false, ARRAY['Benzin']),
            ( 63, 'vehicle_service',  'vehicle', 'expense', '770.04.02', 'Araç Bakım & Servis',    false, ARRAY[]::text[]),
            ( 64, 'vehicle_insurance','vehicle', 'expense', '770.04.03', 'Trafik Sigortası & Kasko', false, ARRAY['Kasko']),
            ( 65, 'parking_toll',     'vehicle', 'expense', '770.04.04', 'Otopark & Geçiş',        false, ARRAY['Otopark']),
            ( 66, 'vehicle_tax',      'vehicle', 'expense', '770.04.05', 'MTV & Muayene',          false, ARRAY[]::text[]),
            ( 67, 'housing',          'e770',  'expense', '770.05',    'Konut',                    true,  ARRAY['Ev']),
            ( 68, 'rent',             'housing', 'expense', '770.05.01', 'Kira',                   false, ARRAY[]::text[]),
            ( 69, 'dues',             'housing', 'expense', '770.05.02', 'Aidat',                  false, ARRAY[]::text[]),
            ( 70, 'repair',           'housing', 'expense', '770.05.03', 'Tadilat & Onarım',       false, ARRAY[]::text[]),
            ( 71, 'home_goods',       'housing', 'expense', '770.05.04', 'Ev Eşyası',              false, ARRAY[]::text[]),
            ( 72, 'home_insurance',   'housing', 'expense', '770.05.05', 'Konut Sigortası & DASK', false, ARRAY['DASK']),
            ( 73, 'bills',            'e770',  'expense', '770.06',    'Fatura',                   true,  ARRAY['Faturalar']),
            ( 74, 'electricity',      'bills', 'expense', '770.06.01', 'Elektrik',                 false, ARRAY[]::text[]),
            ( 75, 'water',            'bills', 'expense', '770.06.02', 'Su',                       false, ARRAY[]::text[]),
            ( 76, 'gas',              'bills', 'expense', '770.06.03', 'Doğalgaz',                 false, ARRAY[]::text[]),
            ( 77, 'internet',         'bills', 'expense', '770.06.04', 'İnternet',                 false, ARRAY[]::text[]),
            ( 78, 'phone',            'bills', 'expense', '770.06.05', 'Telefon',                  false, ARRAY[]::text[]),
            ( 79, 'subscription',     'bills', 'expense', '770.06.06', 'Dijital Abonelik',         false, ARRAY['Abonelik']),
            ( 80, 'health',           'e770',  'expense', '770.07',    'Sağlık',                   true,  ARRAY[]::text[]),
            ( 81, 'doctor',           'health', 'expense', '770.07.01', 'Doktor & Hastane',        false, ARRAY['Hastane', 'Doktor']),
            ( 82, 'medicine',         'health', 'expense', '770.07.02', 'İlaç',                    false, ARRAY[]::text[]),
            ( 83, 'dental',           'health', 'expense', '770.07.03', 'Diş',                     false, ARRAY[]::text[]),
            ( 84, 'health_insurance', 'health', 'expense', '770.07.04', 'Sağlık Sigortası',        false, ARRAY[]::text[]),
            ( 85, 'personal_care',    'e770',  'expense', '770.08',    'Kişisel Bakım',            true,  ARRAY['Bakım']),
            ( 86, 'hairdresser',      'personal_care', 'expense', '770.08.01', 'Kuaför & Berber',  false, ARRAY['Kuaför', 'Berber']),
            ( 87, 'cosmetics',        'personal_care', 'expense', '770.08.02', 'Kozmetik',         false, ARRAY[]::text[]),
            ( 88, 'shopping',         'e770',  'expense', '770.09',    'Alışveriş',                true,  ARRAY[]::text[]),
            ( 89, 'clothing',         'shopping', 'expense', '770.09.01', 'Giyim',                 false, ARRAY['Kıyafet']),
            ( 90, 'electronics',      'shopping', 'expense', '770.09.02', 'Elektronik',            false, ARRAY['Teknoloji']),
            ( 91, 'stationery',       'shopping', 'expense', '770.09.03', 'Kırtasiye & Kitap',     false, ARRAY['Kırtasiye', 'Kitap']),
            ( 92, 'education',        'e770',  'expense', '770.10',    'Eğitim',                   true,  ARRAY[]::text[]),
            ( 93, 'school',           'education', 'expense', '770.10.01', 'Okul',                 false, ARRAY[]::text[]),
            ( 94, 'course',           'education', 'expense', '770.10.02', 'Kurs',                 false, ARRAY[]::text[]),
            ( 95, 'family',           'e770',  'expense', '770.11',    'Aile & Çocuk',             true,  ARRAY['Çocuk']),
            ( 96, 'allowance_given',  'family', 'expense', '770.11.01', 'Harçlık',                 false, ARRAY[]::text[]),
            ( 97, 'toys',             'family', 'expense', '770.11.02', 'Oyuncak',                 false, ARRAY[]::text[]),
            ( 98, 'childcare',        'family', 'expense', '770.11.03', 'Bakıcı',                  false, ARRAY[]::text[]),
            ( 99, 'leisure',          'e770',  'expense', '770.12',    'Eğlence & Hobi',           true,  ARRAY['Eğlence', 'Hobi']),
            (100, 'events',           'leisure', 'expense', '770.12.01', 'Etkinlik',               false, ARRAY['Sinema', 'Konser']),
            (101, 'sports',           'leisure', 'expense', '770.12.02', 'Spor',                   false, ARRAY[]::text[]),
            (102, 'holiday',          'leisure', 'expense', '770.12.03', 'Tatil',                  false, ARRAY['Seyahat']),
            (103, 'taxes',            'e770',  'expense', '770.13',    'Vergi & Resmi Ödeme',      true,  ARRAY['Vergi']),
            (104, 'income_tax',       'taxes', 'expense', '770.13.01', 'Gelir Vergisi',            false, ARRAY[]::text[]),
            (105, 'property_tax',     'taxes', 'expense', '770.13.02', 'Emlak Vergisi',            false, ARRAY[]::text[]),
            (106, 'fees_official',    'taxes', 'expense', '770.13.03', 'Harç',                     false, ARRAY[]::text[]),
            (107, 'fine',             'taxes', 'expense', '770.13.04', 'Ceza',                     false, ARRAY[]::text[]),
            (108, 'gifts_given',      'e770',  'expense', '770.14',    'Hediye & Bağış',           false, ARRAY['Bağış']),
            (109, 'pets',             'e770',  'expense', '770.15',    'Evcil Hayvan',             false, ARRAY[]::text[]),
            (110, 'tobacco_alcohol',  'e770',  'expense', '770.16',    'Sigara & Alkol',           false, ARRAY['Sigara', 'Alkol']),
            (111, 'other_expense',    'e770',  'expense', '770.99',    'Diğer Giderler',           false, ARRAY['Diğer']),
            (120, 'e78',   NULL,   'expense',   '78',  'Finansman Giderleri',           true,  ARRAY[]::text[]),
            (121, 'finance',          'e78',   'expense', '780',       'Finansman Giderleri',      true,  ARRAY['Banka & Finans']),
            (122, 'card_interest',    'finance', 'expense', '780.01',  'Kart Faizi',               false, ARRAY[]::text[]),
            (123, 'loan_cost',        'finance', 'expense', '780.02',  'Kredi Faizi',              false, ARRAY['Kredi Maliyeti']),
            (124, 'loan_fee',         'finance', 'expense', '780.03',  'Kredi Masrafı',            false, ARRAY[]::text[]),
            (125, 'cash_advance_fee', 'finance', 'expense', '780.04',  'Nakit Avans Masrafı',      false, ARRAY[]::text[]),
            (126, 'bank_fee',         'finance', 'expense', '780.05',  'Banka Ücreti',             false, ARRAY['Komisyon', 'İşlem Ücreti', 'Transfer Ücreti']),
            (127, 'deposit_break_fee','finance', 'expense', '780.06',  'Vadeli Bozma Kesintisi',   false, ARRAY[]::text[])
        ) AS t(ord, key, parent_key, type, code, name, placeholder, aliases)
        ORDER BY ord
    LOOP
        v_parent := NULL;
        IF r.parent_key IS NOT NULL THEN
            SELECT id INTO v_parent FROM accounts WHERE group_id = p_group AND template_key = r.parent_key;
        END IF;
        v_code := r.code;
        IF EXISTS (SELECT 1 FROM accounts WHERE group_id = p_group AND code = v_code) THEN
            v_code := account_next_code(v_parent);
        END IF;

        SELECT id INTO v_id FROM accounts WHERE group_id = p_group AND template_key = r.key;
        IF FOUND THEN
            UPDATE accounts SET
                code = v_code,
                name = r.name,
                parent_id = v_parent,
                is_placeholder = r.placeholder AND NOT EXISTS (SELECT 1 FROM journal_lines WHERE account_id = v_id)
            WHERE id = v_id AND code IS NULL;
            CONTINUE;
        END IF;

        IF r.type IN ('income', 'expense') THEN
            SELECT id INTO v_id FROM accounts
            WHERE group_id = p_group AND type = r.type AND system_key IS NULL AND template_key IS NULL
              AND archived_at IS NULL
              AND lower(name) IN (SELECT lower(n) FROM unnest(r.name || r.aliases) n)
            ORDER BY lower(name) = lower(r.name) DESC, created_at
            LIMIT 1;
            IF FOUND THEN
                UPDATE accounts SET
                    template_key = r.key,
                    name = r.name,
                    code = COALESCE(code, v_code),
                    parent_id = CASE WHEN code IS NULL AND v_parent IS DISTINCT FROM id THEN v_parent ELSE parent_id END,
                    is_placeholder = is_placeholder
                        OR (r.placeholder AND NOT EXISTS (SELECT 1 FROM journal_lines WHERE account_id = v_id))
                WHERE id = v_id;
                CONTINUE;
            END IF;
        END IF;

        INSERT INTO accounts (id, group_id, parent_id, type, code, name, is_placeholder, template_key)
        VALUES (gen_random_uuid(), p_group, v_parent, r.type, v_code, r.name, r.placeholder, r.key);
    END LOOP;

    -- System accounts get their TDHP names.
    UPDATE accounts SET name = CASE system_key
            WHEN 'fx_gain_loss' THEN 'Kambiyo Kâr/Zararları'
            WHEN 'investment_gain_loss' THEN 'Menkul Kıymet Satış Kâr/Zararları'
            ELSE name END
    WHERE group_id = p_group AND system_key IN ('fx_gain_loss', 'investment_gain_loss') AND code IS NULL;

    -- Every account without a code: default parent, then the next free code. Parents before children.
    LOOP
        SELECT a.* INTO r FROM accounts a
        WHERE a.group_id = p_group AND a.code IS NULL
          AND (a.parent_id IS NULL OR EXISTS (SELECT 1 FROM accounts p WHERE p.id = a.parent_id AND p.code IS NOT NULL))
        ORDER BY a.created_at, a.id
        LIMIT 1;
        EXIT WHEN NOT FOUND;
        v_parent := COALESCE(r.parent_id, account_default_parent(p_group, r.type, r.subtype, r.system_key));
        v_code := CASE r.system_key WHEN 'investment_gain_loss' THEN '645' WHEN 'fx_gain_loss' THEN '646' END;
        IF v_code IS NULL OR EXISTS (SELECT 1 FROM accounts WHERE group_id = p_group AND code = v_code) THEN
            v_code := account_next_code(v_parent);
        END IF;
        IF v_code IS NULL THEN
            RAISE EXCEPTION 'no code for account %', r.id;
        END IF;
        UPDATE accounts SET parent_id = v_parent, code = v_code WHERE id = r.id;
    END LOOP;

    -- Brand → default category (hidden Directory flow).
    FOR r IN
        SELECT b.name, a.id AS category_id
        FROM (VALUES
            ('Migros', 'groceries'), ('BİM', 'groceries'), ('A101', 'groceries'), ('ŞOK', 'groceries'),
            ('CarrefourSA', 'groceries'), ('Macrocenter', 'groceries'), ('File', 'groceries'),
            ('Yemeksepeti', 'delivery'), ('Trendyol Yemek', 'delivery'), ('Getir Yemek', 'delivery'),
            ('Starbucks', 'cafe'), ('Kahve Dünyası', 'cafe'), ('Espressolab', 'cafe'),
            ('Burger King', 'restaurant'), ('McDonald''s', 'restaurant'), ('Domino''s', 'restaurant'),
            ('İstanbulkart', 'public_transport'), ('Marmaray', 'public_transport'),
            ('BiTaksi', 'taxi'), ('Uber', 'taxi'),
            ('THY', 'intercity'), ('Pegasus', 'intercity'), ('AJet', 'intercity'), ('Obilet', 'intercity'),
            ('Shell', 'fuel'), ('Opet', 'fuel'), ('BP', 'fuel'), ('Petrol Ofisi', 'fuel'), ('Total', 'fuel'),
            ('HGS', 'parking_toll'), ('OGS', 'parking_toll'), ('İspark', 'parking_toll'),
            ('IKEA', 'home_goods'), ('Koçtaş', 'home_goods'), ('English Home', 'home_goods'),
            ('Enerjisa', 'electricity'), ('CK Enerji', 'electricity'),
            ('İSKİ', 'water'), ('ASKİ', 'water'), ('İZSU', 'water'),
            ('İGDAŞ', 'gas'), ('Başkentgaz', 'gas'), ('İzmirgaz', 'gas'),
            ('Superonline', 'internet'), ('TurkNet', 'internet'), ('Türk Telekom', 'internet'),
            ('Turkcell', 'phone'), ('Vodafone', 'phone'),
            ('Netflix', 'subscription'), ('Spotify', 'subscription'), ('YouTube Premium', 'subscription'),
            ('Disney+', 'subscription'), ('Amazon Prime', 'subscription'), ('BluTV', 'subscription'), ('iCloud', 'subscription'),
            ('Gratis', 'cosmetics'), ('Watsons', 'cosmetics'), ('Rossmann', 'cosmetics'),
            ('LC Waikiki', 'clothing'), ('DeFacto', 'clothing'), ('Koton', 'clothing'), ('Zara', 'clothing'), ('Mavi', 'clothing'),
            ('MediaMarkt', 'electronics'), ('Teknosa', 'electronics'), ('Vatan Bilgisayar', 'electronics'),
            ('D&R', 'stationery'), ('Kitapyurdu', 'stationery'),
            ('Biletix', 'events'), ('Passo', 'events'), ('Paribu Cineverse', 'events'),
            ('MAC', 'sports'),
            ('Eczane', 'medicine')
        ) AS b(name, key)
        JOIN accounts a ON a.group_id = p_group AND a.template_key = b.key
    LOOP
        IF EXISTS (SELECT 1 FROM contacts WHERE group_id = p_group AND lower(name) = lower(r.name)) THEN
            UPDATE contacts SET default_category_id = r.category_id
            WHERE group_id = p_group AND lower(name) = lower(r.name) AND kind = 'brand' AND default_category_id IS NULL;
        ELSE
            INSERT INTO contacts (id, group_id, kind, name, default_category_id)
            VALUES (gen_random_uuid(), p_group, 'brand', r.name, r.category_id);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4. Existing data --------------------------------------------------------------------------------------

ALTER TABLE accounts DISABLE TRIGGER accounts_used_chk;

-- Income/expense accounts get the base currency.
UPDATE accounts a SET currency = g.base_currency FROM groups g WHERE g.id = a.group_id AND a.currency IS NULL;

-- Lines on them in another currency are restated in the base currency (their base_amount is the booked value).
UPDATE journal_lines l SET currency = a.currency, amount = l.base_amount, fx_rate = 1
FROM accounts a WHERE a.id = l.account_id AND a.type IN ('income', 'expense') AND l.currency <> a.currency;

ALTER TABLE accounts ENABLE TRIGGER accounts_used_chk;

-- The old "Yatırım Getirisi" placeholder: its children move under 64; drop it when nothing refers to it.
UPDATE accounts SET template_key = NULL WHERE template_key = 'investment_income';

SELECT apply_account_template(id) FROM groups;

DELETE FROM accounts a
WHERE a.is_placeholder AND a.name = 'Yatırım Getirisi' AND a.template_key IS NULL
  AND NOT EXISTS (SELECT 1 FROM accounts c WHERE c.parent_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM journal_lines l WHERE l.account_id = a.id)
  AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.default_category_id = a.id);

ALTER TABLE accounts ALTER COLUMN currency SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN code SET NOT NULL;

REVOKE EXECUTE ON FUNCTION account_default_parent(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION account_next_code(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION accounts_fill_defaults() FROM PUBLIC, anon, authenticated;
