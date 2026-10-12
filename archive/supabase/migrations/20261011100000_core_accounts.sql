-- Core accounts: the fixed set every group has, locked at the database level.
-- * Core = roots, system groups, Kişilerden Alacaklar, Kişilere Borçlar, Banka Ücreti (template rows with locked = true)
--   and the system_key accounts (Açılış Bakiyesi, Kambiyo, Menkul Kıymet). Recommended = every other template row.
-- * apply_account_template(group, p_recommended): false creates the core rows only.
-- * A system_key account is locked from insert on.

DROP FUNCTION apply_account_template(uuid);

CREATE FUNCTION apply_account_template(p_group uuid, p_recommended boolean DEFAULT true) RETURNS void AS $$
DECLARE
    r record;
    v_id uuid;
    v_parent uuid;
    v_code text;
    v_tmp constant text := '^9[0-9]{9}$';
BEGIN
    PERFORM set_config('app.template_apply', 'on', true);
    FOR r IN
        SELECT * FROM (VALUES
            -- (order, key, parent key, type, root code, name, placeholder, locked, subtype, aliases)
            (  1, 'a',        NULL,  'asset',     '1', 'Varlık',    true,  true,  NULL,         ARRAY[]::text[]),
            (  2, 'a_cash',   'a',   'asset',     NULL, 'Nakit',    true,  true,  'cash',       ARRAY[]::text[]),
            (  3, 'a_bank',   'a',   'asset',     NULL, 'Banka',    true,  true,  'bank',       ARRAY[]::text[]),
            (  4, 'a_invest', 'a',   'asset',     NULL, 'Yatırım',  true,  true,  NULL,         ARRAY[]::text[]),
            (  5, 'a_fixed',  'a',   'asset',     NULL, 'Duran Varlıklar', true, true, NULL,    ARRAY[]::text[]),
            (  6, 'a_recv',   'a',   'asset',     NULL, 'Kişilerden Alacaklar', false, true, 'receivable', ARRAY[]::text[]),
            (  7, 'l',        NULL,  'liability', '2', 'Borç',      true,  true,  NULL,         ARRAY[]::text[]),
            (  8, 'l_card',   'l',   'liability', NULL, 'Kredi Kartı', true, true, 'credit_card', ARRAY[]::text[]),
            (  9, 'l_loan',   'l',   'liability', NULL, 'Krediler', true,  true,  'loan',       ARRAY[]::text[]),
            ( 10, 'l_pay',    'l',   'liability', NULL, 'Kişilere Borçlar', false, true, 'payable', ARRAY[]::text[]),
            ( 11, 'q',        NULL,  'equity',    '3', 'Özkaynak',  true,  true,  NULL,         ARRAY[]::text[]),
            ( 12, 'i',        NULL,  'income',    '4', 'Gelir',     true,  true,  NULL,         ARRAY[]::text[]),
            ( 13, 'salary',        'i', 'income', NULL, 'Maaş',               false, false, NULL, ARRAY[]::text[]),
            ( 14, 'bonus',         'i', 'income', NULL, 'Prim ve İkramiye',   false, false, NULL, ARRAY['Prim', 'İkramiye', 'Prim & İkramiye']),
            ( 15, 'side_income',   'i', 'income', NULL, 'Ek Gelir',           false, false, NULL, ARRAY[]::text[]),
            ( 16, 'deposit_return','i', 'income', NULL, 'Faiz Gelirleri',     false, false, NULL, ARRAY['Vadeli getiri', 'Faiz', 'Faiz & Vadeli Getiri']),
            ( 17, 'dividend',      'i', 'income', NULL, 'Temettü Gelirleri',  false, false, NULL, ARRAY['Temettü']),
            ( 18, 'rental_income', 'i', 'income', NULL, 'Kira Geliri',        false, false, NULL, ARRAY[]::text[]),
            ( 19, 'allowance',     'i', 'income', NULL, 'Harçlık',            false, false, NULL, ARRAY[]::text[]),
            ( 20, 'gift_received', 'i', 'income', NULL, 'Hediye',             false, false, NULL, ARRAY[]::text[]),
            ( 21, 'other_income',  'i', 'income', NULL, 'Diğer Gelirler',     false, false, NULL, ARRAY['Diğer']),
            ( 30, 'e',        NULL,  'expense',   '5', 'Gider',     true,  true,  NULL,         ARRAY[]::text[]),
            ( 30.5, 'bank_fee',       'e',  'expense', NULL, 'Banka Ücreti',            false, true,  NULL, ARRAY['Komisyon', 'İşlem Ücreti', 'Transfer Ücreti']),
            ( 31, 'groceries',        'e',  'expense', NULL, 'Market',                  false, false, NULL, ARRAY[]::text[]),
            ( 32, 'food',             'e',  'expense', NULL, 'Yeme-İçme',               true,  false, NULL, ARRAY['Yeme İçme', 'Yemek']),
            ( 33, 'restaurant',       'food', 'expense', NULL, 'Restoran',              false, false, NULL, ARRAY[]::text[]),
            ( 34, 'cafe',             'food', 'expense', NULL, 'Kafe & Kahve',          false, false, NULL, ARRAY['Kahve', 'Kafe']),
            ( 35, 'delivery',         'food', 'expense', NULL, 'Paket Servis',          false, false, NULL, ARRAY[]::text[]),
            ( 36, 'transport',        'e',  'expense', NULL, 'Ulaşım',                  true,  false, NULL, ARRAY[]::text[]),
            ( 37, 'public_transport', 'transport', 'expense', NULL, 'Toplu Taşıma',     false, false, NULL, ARRAY[]::text[]),
            ( 38, 'taxi',             'transport', 'expense', NULL, 'Taksi',            false, false, NULL, ARRAY[]::text[]),
            ( 39, 'intercity',        'transport', 'expense', NULL, 'Şehirlerarası Yolculuk', false, false, NULL, ARRAY[]::text[]),
            ( 40, 'vehicle',          'e',  'expense', NULL, 'Araç',                    true,  false, NULL, ARRAY['Araba']),
            ( 41, 'fuel',             'vehicle', 'expense', NULL, 'Yakıt',              false, false, NULL, ARRAY['Benzin']),
            ( 42, 'vehicle_service',  'vehicle', 'expense', NULL, 'Araç Bakım & Servis', false, false, NULL, ARRAY[]::text[]),
            ( 43, 'vehicle_insurance','vehicle', 'expense', NULL, 'Trafik Sigortası & Kasko', false, false, NULL, ARRAY['Kasko']),
            ( 44, 'parking_toll',     'vehicle', 'expense', NULL, 'Otopark & Geçiş',    false, false, NULL, ARRAY['Otopark']),
            ( 45, 'housing',          'e',  'expense', NULL, 'Konut',                   true,  false, NULL, ARRAY['Ev']),
            ( 46, 'rent',             'housing', 'expense', NULL, 'Kira',               false, false, NULL, ARRAY[]::text[]),
            ( 47, 'dues',             'housing', 'expense', NULL, 'Aidat',              false, false, NULL, ARRAY[]::text[]),
            ( 48, 'repair',           'housing', 'expense', NULL, 'Tadilat & Onarım',   false, false, NULL, ARRAY[]::text[]),
            ( 49, 'home_goods',       'housing', 'expense', NULL, 'Ev Eşyası',          false, false, NULL, ARRAY[]::text[]),
            ( 50, 'bills',            'e',  'expense', NULL, 'Fatura',                  true,  false, NULL, ARRAY['Faturalar']),
            ( 51, 'electricity',      'bills', 'expense', NULL, 'Elektrik',             false, false, NULL, ARRAY[]::text[]),
            ( 52, 'water',            'bills', 'expense', NULL, 'Su',                   false, false, NULL, ARRAY[]::text[]),
            ( 53, 'gas',              'bills', 'expense', NULL, 'Doğalgaz',             false, false, NULL, ARRAY[]::text[]),
            ( 54, 'internet',         'bills', 'expense', NULL, 'İnternet',             false, false, NULL, ARRAY[]::text[]),
            ( 55, 'phone',            'bills', 'expense', NULL, 'Telefon',              false, false, NULL, ARRAY[]::text[]),
            ( 56, 'subscription',     'bills', 'expense', NULL, 'Dijital Abonelik',     false, false, NULL, ARRAY['Abonelik']),
            ( 57, 'health',           'e',  'expense', NULL, 'Sağlık',                  true,  false, NULL, ARRAY[]::text[]),
            ( 58, 'doctor',           'health', 'expense', NULL, 'Doktor & Hastane',    false, false, NULL, ARRAY['Hastane', 'Doktor']),
            ( 59, 'medicine',         'health', 'expense', NULL, 'İlaç',                false, false, NULL, ARRAY[]::text[]),
            ( 60, 'personal_care',    'e',  'expense', NULL, 'Kişisel Bakım',           true,  false, NULL, ARRAY['Bakım']),
            ( 61, 'hairdresser',      'personal_care', 'expense', NULL, 'Kuaför & Berber', false, false, NULL, ARRAY['Kuaför', 'Berber']),
            ( 62, 'cosmetics',        'personal_care', 'expense', NULL, 'Kozmetik',     false, false, NULL, ARRAY[]::text[]),
            ( 63, 'shopping',         'e',  'expense', NULL, 'Alışveriş',               true,  false, NULL, ARRAY[]::text[]),
            ( 64, 'clothing',         'shopping', 'expense', NULL, 'Giyim',             false, false, NULL, ARRAY['Kıyafet']),
            ( 65, 'electronics',      'shopping', 'expense', NULL, 'Elektronik',        false, false, NULL, ARRAY['Teknoloji']),
            ( 66, 'stationery',       'shopping', 'expense', NULL, 'Kırtasiye & Kitap', false, false, NULL, ARRAY['Kırtasiye', 'Kitap']),
            ( 67, 'education',        'e',  'expense', NULL, 'Eğitim',                  false, false, NULL, ARRAY[]::text[]),
            ( 68, 'leisure',          'e',  'expense', NULL, 'Eğlence & Hobi',          true,  false, NULL, ARRAY['Eğlence', 'Hobi']),
            ( 69, 'events',           'leisure', 'expense', NULL, 'Etkinlik',           false, false, NULL, ARRAY['Sinema', 'Konser']),
            ( 70, 'sports',           'leisure', 'expense', NULL, 'Spor',               false, false, NULL, ARRAY[]::text[]),
            ( 71, 'holiday',          'leisure', 'expense', NULL, 'Tatil',              false, false, NULL, ARRAY['Seyahat']),
            ( 72, 'family',           'e',  'expense', NULL, 'Aile & Çocuk',            false, false, NULL, ARRAY['Çocuk']),
            ( 73, 'taxes',            'e',  'expense', NULL, 'Vergi & Resmi Ödeme',     false, false, NULL, ARRAY['Vergi']),
            ( 74, 'gifts_given',      'e',  'expense', NULL, 'Hediye & Bağış',          false, false, NULL, ARRAY['Bağış']),
            ( 75, 'finance',          'e',  'expense', NULL, 'Finansman Giderleri',     true,  false, NULL, ARRAY['Banka & Finans']),
            ( 76, 'card_interest',    'finance', 'expense', NULL, 'Kart Faizi',         false, false, NULL, ARRAY[]::text[]),
            ( 77, 'loan_cost',        'finance', 'expense', NULL, 'Kredi Faizi',        false, false, NULL, ARRAY['Kredi Maliyeti']),
            ( 78, 'loan_fee',         'finance', 'expense', NULL, 'Kredi Masrafı',      false, false, NULL, ARRAY[]::text[]),
            ( 79, 'cash_advance_fee', 'finance', 'expense', NULL, 'Nakit Avans Masrafı', false, false, NULL, ARRAY[]::text[]),
            ( 81, 'deposit_break_fee','finance', 'expense', NULL, 'Vadeli Bozma Kesintisi', false, false, NULL, ARRAY[]::text[]),
            ( 82, 'other_expense',    'e',  'expense', NULL, 'Diğer Giderler',          false, false, NULL, ARRAY['Diğer'])
        ) AS t(ord, key, parent_key, type, root_code, name, placeholder, locked, subtype, aliases)
        ORDER BY ord
    LOOP
        CONTINUE WHEN NOT p_recommended AND NOT r.locked;
        v_parent := NULL;
        IF r.parent_key IS NOT NULL THEN
            SELECT id INTO v_parent FROM accounts WHERE group_id = p_group AND template_key = r.parent_key;
        END IF;

        SELECT id INTO v_id FROM accounts WHERE group_id = p_group AND template_key = r.key;
        IF NOT FOUND AND r.type IN ('income', 'expense') THEN
            SELECT id INTO v_id FROM accounts
            WHERE group_id = p_group AND type = r.type AND system_key IS NULL AND template_key IS NULL
              AND archived_at IS NULL
              AND lower(name) IN (SELECT lower(n) FROM unnest(r.name || r.aliases) n)
            ORDER BY lower(name) = lower(r.name) DESC, created_at
            LIMIT 1;
            IF FOUND THEN
                UPDATE accounts SET template_key = r.key, name = r.name WHERE id = v_id;
            END IF;
        END IF;

        IF v_id IS NOT NULL THEN
            -- Existing node: group flag follows the template unless the account has lines; locked follows the template.
            -- Place and code only while the node is uncoded or temporary (a user move stays).
            UPDATE accounts SET
                locked = r.locked,
                subtype = COALESCE(r.subtype, subtype),
                is_placeholder = r.placeholder AND NOT EXISTS (SELECT 1 FROM journal_lines WHERE account_id = v_id)
            WHERE id = v_id;
            IF EXISTS (SELECT 1 FROM accounts WHERE id = v_id AND (code IS NULL OR code ~ v_tmp)) THEN
                v_code := COALESCE(r.root_code, account_next_code(v_parent));
                UPDATE accounts SET parent_id = v_parent, code = v_code, name = r.name WHERE id = v_id;
            END IF;
        ELSE
            v_code := COALESCE(r.root_code, account_next_code(v_parent));
            INSERT INTO accounts (id, group_id, parent_id, type, subtype, code, name, is_placeholder, locked, template_key)
            VALUES (gen_random_uuid(), p_group, v_parent, r.type, r.subtype, v_code, r.name, r.placeholder, r.locked, r.key);
        END IF;
    END LOOP;

    -- System accounts get their names.
    UPDATE accounts SET name = CASE system_key
            WHEN 'fx_gain_loss' THEN 'Kambiyo Kâr/Zararları'
            WHEN 'investment_gain_loss' THEN 'Menkul Kıymet Satış Kâr/Zararları'
            ELSE name END
    WHERE group_id = p_group AND system_key IN ('fx_gain_loss', 'investment_gain_loss');

    -- Every uncoded account: default parent (if none), then the next free code. Parents before children.
    LOOP
        SELECT a.* INTO r FROM accounts a
        WHERE a.group_id = p_group AND (a.code IS NULL OR a.code ~ v_tmp)
          AND (a.parent_id IS NULL OR EXISTS (
                SELECT 1 FROM accounts p WHERE p.id = a.parent_id AND p.code IS NOT NULL AND p.code !~ v_tmp))
        ORDER BY a.created_at, a.id
        LIMIT 1;
        EXIT WHEN NOT FOUND;
        v_parent := COALESCE(r.parent_id, account_default_parent(p_group, r.type, r.subtype, r.system_key));
        v_code := account_next_code(v_parent);
        IF v_code IS NULL THEN
            RAISE EXCEPTION 'no code for account %', r.id;
        END IF;
        UPDATE accounts SET parent_id = v_parent, code = v_code,
            subtype = COALESCE(subtype, (SELECT subtype FROM accounts WHERE id = v_parent))
        WHERE id = r.id;
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
    PERFORM set_config('app.template_apply', 'off', true);
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- A system_key account is locked from insert on.
CREATE OR REPLACE FUNCTION accounts_fill_defaults() RETURNS trigger AS $$
BEGIN
    IF NEW.currency IS NULL THEN
        SELECT base_currency INTO NEW.currency FROM groups WHERE id = NEW.group_id;
    END IF;
    IF NEW.system_key IS NOT NULL THEN
        NEW.locked := true;
    END IF;
    IF NEW.parent_id IS NULL AND NEW.template_key IS NULL THEN
        NEW.parent_id := account_default_parent(NEW.group_id, NEW.type, NEW.subtype, NEW.system_key);
    END IF;
    IF NEW.subtype IS NULL AND NEW.parent_id IS NOT NULL THEN
        SELECT subtype INTO NEW.subtype FROM accounts WHERE id = NEW.parent_id;
    END IF;
    IF NEW.code IS NULL THEN
        NEW.code := account_next_code(NEW.parent_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Existing data: lock system accounts; Banka Ücreti moves under the Gider root and locks.
DO $$
DECLARE
    g record;
    v_root uuid;
BEGIN
    PERFORM set_config('app.template_apply', 'on', true);
    UPDATE accounts SET locked = true WHERE system_key IS NOT NULL AND NOT locked;
    FOR g IN SELECT id FROM groups LOOP
        SELECT id INTO v_root FROM accounts WHERE group_id = g.id AND template_key = 'e';
        UPDATE accounts SET locked = true, parent_id = v_root, code = account_next_code(v_root)
        WHERE group_id = g.id AND template_key = 'bank_fee' AND parent_id IS DISTINCT FROM v_root;
        UPDATE accounts SET locked = true WHERE group_id = g.id AND template_key = 'bank_fee';
    END LOOP;
    PERFORM set_config('app.template_apply', 'off', true);
END $$;
