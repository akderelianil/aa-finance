-- Davet kodu tahmin denemeleri (yalnız başarısızlar). Sunucu bağlantısı yazar/okur; istemci erişimi yok.
CREATE TABLE invite_attempts (
    id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invite_attempts_user_idx ON invite_attempts(user_id, at);
ALTER TABLE invite_attempts ENABLE ROW LEVEL SECURITY;
