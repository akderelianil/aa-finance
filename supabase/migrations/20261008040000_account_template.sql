-- Account template: a ready category tree, brand → category defaults and a wallet for every member.
-- template_key is a stable id for a template category. The user can rename, move or archive it;
-- the code finds the categories it posts to (loan fee, deposit return, ...) by this key, not by name.
-- is_placeholder is set per node here and stays a manual setting after that.

ALTER TABLE accounts ADD COLUMN template_key text;
ALTER TABLE accounts ADD CONSTRAINT accounts_template_key_chk
    CHECK (template_key IS NULL OR type IN ('income', 'expense'));
CREATE UNIQUE INDEX accounts_template_unique ON accounts(group_id, template_key) WHERE template_key IS NOT NULL;

-- Idempotent. A missing node is created; an active category with the same name (or an alias) and no key is adopted:
-- it gets the key and the template name, goes under the template parent if it has no parent,
-- and becomes a placeholder only if the template says so and it has no lines.
CREATE FUNCTION apply_account_template(p_group uuid) RETURNS void AS $$
DECLARE
    r record;
    v_id uuid;
    v_parent uuid;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            -- (order, key, parent key, type, name, placeholder, aliases)
            ( 1, 'groceries',          NULL,        'expense', 'Market',                  false, ARRAY[]::text[]),
            ( 2, 'food',               NULL,        'expense', 'Yeme-İçme',               true,  ARRAY['Yeme İçme', 'Yemek']),
            ( 3, 'restaurant',         'food',      'expense', 'Restoran',                false, ARRAY[]::text[]),
            ( 4, 'cafe',               'food',      'expense', 'Kafe & Kahve',            false, ARRAY['Kahve', 'Kafe']),
            ( 5, 'delivery',           'food',      'expense', 'Paket Servis',            false, ARRAY[]::text[]),
            ( 6, 'transport',          NULL,        'expense', 'Ulaşım',                  true,  ARRAY[]::text[]),
            ( 7, 'public_transport',   'transport', 'expense', 'Toplu Taşıma',            false, ARRAY[]::text[]),
            ( 8, 'taxi',               'transport', 'expense', 'Taksi',                   false, ARRAY[]::text[]),
            ( 9, 'intercity',          'transport', 'expense', 'Şehirlerarası Yolculuk',  false, ARRAY[]::text[]),
            (10, 'vehicle',            NULL,        'expense', 'Araç',                    true,  ARRAY['Araba']),
            (11, 'fuel',               'vehicle',   'expense', 'Yakıt',                   false, ARRAY['Benzin']),
            (12, 'vehicle_service',    'vehicle',   'expense', 'Araç Bakım & Servis',     false, ARRAY[]::text[]),
            (13, 'vehicle_insurance',  'vehicle',   'expense', 'Trafik Sigortası & Kasko', false, ARRAY['Kasko']),
            (14, 'parking_toll',       'vehicle',   'expense', 'Otopark & Geçiş',         false, ARRAY['Otopark']),
            (15, 'vehicle_tax',        'vehicle',   'expense', 'MTV & Muayene',           false, ARRAY[]::text[]),
            (16, 'housing',            NULL,        'expense', 'Konut',                   true,  ARRAY['Ev']),
            (17, 'rent',               'housing',   'expense', 'Kira',                    false, ARRAY[]::text[]),
            (18, 'dues',               'housing',   'expense', 'Aidat',                   false, ARRAY[]::text[]),
            (19, 'repair',             'housing',   'expense', 'Tadilat & Onarım',        false, ARRAY[]::text[]),
            (20, 'home_goods',         'housing',   'expense', 'Ev Eşyası',               false, ARRAY[]::text[]),
            (21, 'home_insurance',     'housing',   'expense', 'Konut Sigortası & DASK',  false, ARRAY['DASK']),
            (22, 'bills',              NULL,        'expense', 'Fatura',                  true,  ARRAY['Faturalar']),
            (23, 'electricity',        'bills',     'expense', 'Elektrik',                false, ARRAY[]::text[]),
            (24, 'water',              'bills',     'expense', 'Su',                      false, ARRAY[]::text[]),
            (25, 'gas',                'bills',     'expense', 'Doğalgaz',                false, ARRAY[]::text[]),
            (26, 'internet',           'bills',     'expense', 'İnternet',                false, ARRAY[]::text[]),
            (27, 'phone',              'bills',     'expense', 'Telefon',                 false, ARRAY[]::text[]),
            (28, 'subscription',       'bills',     'expense', 'Dijital Abonelik',        false, ARRAY['Abonelik']),
            (29, 'health',             NULL,        'expense', 'Sağlık',                  true,  ARRAY[]::text[]),
            (30, 'doctor',             'health',    'expense', 'Doktor & Hastane',        false, ARRAY['Hastane', 'Doktor']),
            (31, 'medicine',           'health',    'expense', 'İlaç',                    false, ARRAY[]::text[]),
            (32, 'dental',             'health',    'expense', 'Diş',                     false, ARRAY[]::text[]),
            (33, 'health_insurance',   'health',    'expense', 'Sağlık Sigortası',        false, ARRAY[]::text[]),
            (34, 'personal_care',      NULL,        'expense', 'Kişisel Bakım',           true,  ARRAY['Bakım']),
            (35, 'hairdresser',        'personal_care', 'expense', 'Kuaför & Berber',     false, ARRAY['Kuaför', 'Berber']),
            (36, 'cosmetics',          'personal_care', 'expense', 'Kozmetik',            false, ARRAY[]::text[]),
            (37, 'shopping',           NULL,        'expense', 'Alışveriş',               true,  ARRAY[]::text[]),
            (38, 'clothing',           'shopping',  'expense', 'Giyim',                   false, ARRAY['Kıyafet']),
            (39, 'electronics',        'shopping',  'expense', 'Elektronik',              false, ARRAY['Teknoloji']),
            (40, 'stationery',         'shopping',  'expense', 'Kırtasiye & Kitap',       false, ARRAY['Kırtasiye', 'Kitap']),
            (41, 'education',          NULL,        'expense', 'Eğitim',                  true,  ARRAY[]::text[]),
            (42, 'school',             'education', 'expense', 'Okul',                    false, ARRAY[]::text[]),
            (43, 'course',             'education', 'expense', 'Kurs',                    false, ARRAY[]::text[]),
            (44, 'family',             NULL,        'expense', 'Aile & Çocuk',            true,  ARRAY['Çocuk']),
            (45, 'allowance_given',    'family',    'expense', 'Harçlık',                 false, ARRAY[]::text[]),
            (46, 'toys',               'family',    'expense', 'Oyuncak',                 false, ARRAY[]::text[]),
            (47, 'childcare',          'family',    'expense', 'Bakıcı',                  false, ARRAY[]::text[]),
            (48, 'leisure',            NULL,        'expense', 'Eğlence & Hobi',          true,  ARRAY['Eğlence', 'Hobi']),
            (49, 'events',             'leisure',   'expense', 'Etkinlik',                false, ARRAY['Sinema', 'Konser']),
            (50, 'sports',             'leisure',   'expense', 'Spor',                    false, ARRAY[]::text[]),
            (51, 'holiday',            'leisure',   'expense', 'Tatil',                   false, ARRAY['Seyahat']),
            (52, 'taxes',              NULL,        'expense', 'Vergi & Resmi Ödeme',     true,  ARRAY['Vergi']),
            (53, 'income_tax',         'taxes',     'expense', 'Gelir Vergisi',           false, ARRAY[]::text[]),
            (54, 'property_tax',       'taxes',     'expense', 'Emlak Vergisi',           false, ARRAY[]::text[]),
            (55, 'fees_official',      'taxes',     'expense', 'Harç',                    false, ARRAY[]::text[]),
            (56, 'fine',               'taxes',     'expense', 'Ceza',                    false, ARRAY[]::text[]),
            (57, 'finance',            NULL,        'expense', 'Banka & Finans',          true,  ARRAY[]::text[]),
            (58, 'bank_fee',           'finance',   'expense', 'Banka Ücreti',            false, ARRAY['Komisyon', 'İşlem Ücreti', 'Transfer Ücreti']),
            (59, 'card_interest',      'finance',   'expense', 'Kart Faizi',              false, ARRAY[]::text[]),
            (60, 'loan_fee',           'finance',   'expense', 'Kredi Masrafı',           false, ARRAY[]::text[]),
            (61, 'loan_cost',          'finance',   'expense', 'Kredi Maliyeti',          false, ARRAY[]::text[]),
            (62, 'cash_advance_fee',   'finance',   'expense', 'Nakit Avans Masrafı',     false, ARRAY[]::text[]),
            (63, 'deposit_break_fee',  'finance',   'expense', 'Vadeli Bozma Kesintisi',  false, ARRAY[]::text[]),
            (64, 'gifts_given',        NULL,        'expense', 'Hediye & Bağış',          false, ARRAY['Bağış']),
            (65, 'pets',               NULL,        'expense', 'Evcil Hayvan',            false, ARRAY[]::text[]),
            (66, 'tobacco_alcohol',    NULL,        'expense', 'Sigara & Alkol',          false, ARRAY['Sigara', 'Alkol']),
            (67, 'other_expense',      NULL,        'expense', 'Diğer',                   false, ARRAY[]::text[]),
            (70, 'salary',             NULL,        'income',  'Maaş',                    false, ARRAY[]::text[]),
            (71, 'bonus',              NULL,        'income',  'Prim & İkramiye',         false, ARRAY['Prim', 'İkramiye']),
            (72, 'side_income',        NULL,        'income',  'Ek Gelir',                false, ARRAY[]::text[]),
            (73, 'allowance',          NULL,        'income',  'Harçlık',                 false, ARRAY[]::text[]),
            (74, 'gift_received',      NULL,        'income',  'Hediye',                  false, ARRAY[]::text[]),
            (75, 'coupon',             NULL,        'income',  'Kupon & Hediye Çeki',     false, ARRAY['Kupon']),
            (76, 'rental_income',      NULL,        'income',  'Kira Geliri',             false, ARRAY[]::text[]),
            (77, 'investment_income',  NULL,        'income',  'Yatırım Getirisi',        true,  ARRAY[]::text[]),
            (78, 'deposit_return',     'investment_income', 'income', 'Faiz & Vadeli Getiri', false, ARRAY['Vadeli getiri', 'Faiz']),
            (79, 'dividend',           'investment_income', 'income', 'Temettü',          false, ARRAY[]::text[]),
            (80, 'other_income',       NULL,        'income',  'Diğer',                   false, ARRAY[]::text[])
        ) AS t(ord, key, parent_key, type, name, placeholder, aliases)
        ORDER BY ord
    LOOP
        PERFORM 1 FROM accounts WHERE group_id = p_group AND template_key = r.key;
        CONTINUE WHEN FOUND;

        v_parent := NULL;
        IF r.parent_key IS NOT NULL THEN
            SELECT id INTO v_parent FROM accounts WHERE group_id = p_group AND template_key = r.parent_key;
        END IF;

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
                parent_id = CASE WHEN parent_id IS NULL AND v_parent IS DISTINCT FROM id THEN v_parent ELSE parent_id END,
                is_placeholder = is_placeholder
                    OR (r.placeholder AND NOT EXISTS (SELECT 1 FROM journal_lines WHERE account_id = v_id))
            WHERE id = v_id;
        ELSE
            INSERT INTO accounts (id, group_id, parent_id, type, name, is_placeholder, template_key)
            VALUES (gen_random_uuid(), p_group, v_parent, r.type, r.name, r.placeholder, r.key);
        END IF;
    END LOOP;

    -- Brand → default category. An existing brand keeps its own category; a person or business with the name is left alone.
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

REVOKE EXECUTE ON FUNCTION apply_account_template(uuid) FROM PUBLIC, anon, authenticated;

-- Existing groups get the template.
SELECT apply_account_template(id) FROM groups;

-- Every member has a wallet ("Nakit", base currency). A new member gets it at onboarding.
INSERT INTO accounts (id, group_id, owner_member_id, type, subtype, name, currency)
SELECT gen_random_uuid(), m.group_id, m.id, 'asset', 'cash', 'Nakit', g.base_currency
FROM members m JOIN groups g ON g.id = m.group_id
WHERE NOT EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.owner_member_id = m.id AND a.subtype = 'cash' AND a.currency = g.base_currency AND a.archived_at IS NULL);
