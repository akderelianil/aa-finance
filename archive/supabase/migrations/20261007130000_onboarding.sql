-- Onboarding: profil alanları, tek grup kuralı, davet kodları.

-- Profil: ad/soyad/doğum tarihi onboarding'de doldurulur. display_name ad+soyaddan türetilir.
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    INSERT INTO public.profiles (id) VALUES (NEW.id);
    RETURN NEW;
END $$;

ALTER TABLE profiles DROP COLUMN display_name;
ALTER TABLE profiles
    ADD COLUMN first_name text,
    ADD COLUMN last_name text,
    ADD COLUMN birth_date date CHECK (birth_date IS NULL OR birth_date <= current_date),
    ADD COLUMN display_name text GENERATED ALWAYS AS
        (NULLIF(btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')) STORED;

-- Şimdilik bir kullanıcı tek gruba üye olabilir. Çoklu gruba geçerken bu kısıt kaldırılır.
ALTER TABLE members ADD CONSTRAINT members_one_group_per_user UNIQUE (user_id);

-- Davet kodları: grup üyeleri görür; oluşturma/kullanma Edge Function'dan.
-- code: büyük harf, karışabilen karakterler (0/O, 1/I) hariç, 8 hane.
CREATE TABLE group_invites (
    id         uuid PRIMARY KEY,
    group_id   uuid NOT NULL REFERENCES groups(id),
    code       text NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
    created_by uuid NOT NULL REFERENCES members(id),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    use_count  integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
    max_uses   integer CHECK (max_uses IS NULL OR max_uses > 0),   -- NULL = sınırsız (süre dolana kadar)
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX group_invites_group_idx ON group_invites(group_id);

ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_invites_select ON group_invites FOR SELECT TO authenticated
    USING (is_group_member(group_id));
GRANT SELECT ON group_invites TO authenticated;

CREATE TRIGGER group_invites_audit AFTER INSERT OR UPDATE OR DELETE ON group_invites
    FOR EACH ROW EXECUTE FUNCTION audit_row();
