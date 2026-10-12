-- Fiş/fatura ekleri için özel (private) depolama kovası. Yazma yalnız Edge Function'lardan (imzalı yükleme URL'si);
-- okuma: nesne yolunun ilk parçası grup id'sidir, grup üyeleri görür.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('attachments', 'attachments', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY attachments_objects_select ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'attachments' AND is_group_member(((storage.foldername(name))[1])::uuid));
