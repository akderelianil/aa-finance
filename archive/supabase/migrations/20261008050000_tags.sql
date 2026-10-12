-- Etiket: kategori ve kişiye çapraz gruplama ("Tatil 2026", "Düğün"). Grup ortak, kayda (journal_entries) bağlı.
-- Yazma yalnız Edge Function'lar üzerinden (kayıt oluşturma/düzenleme ile aynı transaction).

CREATE TABLE tags (
    id         uuid PRIMARY KEY,
    group_id   uuid NOT NULL REFERENCES groups(id),
    name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 40),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, group_id)
);
CREATE UNIQUE INDEX tags_group_name_idx ON tags (group_id, lower(name));

CREATE TABLE entry_tags (
    entry_id uuid NOT NULL REFERENCES journal_entries(id),
    tag_id   uuid NOT NULL,
    group_id uuid NOT NULL REFERENCES groups(id),
    PRIMARY KEY (entry_id, tag_id),
    FOREIGN KEY (tag_id, group_id) REFERENCES tags(id, group_id)
);
CREATE INDEX entry_tags_tag_idx ON entry_tags (tag_id, group_id);
CREATE INDEX entry_tags_group_idx ON entry_tags (group_id);

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['tags', 'entry_tags']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING ((SELECT is_group_member(group_id)))',
                       t || '_select', t);
        EXECUTE format('GRANT SELECT ON %I TO authenticated', t);
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I
                        FOR EACH ROW EXECUTE FUNCTION audit_row()', t || '_audit', t);
    END LOOP;
END $$;
