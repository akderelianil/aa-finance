-- Kullanıcı profil fotoğrafı ve aile/grup görseli + grup türü.
-- avatar_url: 'avatars' kovasındaki nesne yolu (users/<user_id>/... veya groups/<group_id>/...).
ALTER TABLE profiles ADD COLUMN avatar_url text;
ALTER TABLE groups
    ADD COLUMN avatar_url text,
    ADD COLUMN kind text NOT NULL DEFAULT 'family' CHECK (kind IN ('family', 'group'));

-- Herkese açık okunur kova (yalnız küçük görseller); yazma yalnız Edge Function'dan (imzalı yükleme).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
