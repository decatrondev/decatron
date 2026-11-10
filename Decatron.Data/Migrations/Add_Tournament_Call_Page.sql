-- Platform-owned informational call page. No tenant/customer data.
BEGIN;
CREATE TABLE IF NOT EXISTS tournament_call_page (
    id integer PRIMARY KEY CHECK (id = 1),
    draft jsonb NOT NULL DEFAULT '{}',
    published jsonb,
    revision bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tournament_call_page (id, draft)
VALUES (1, '{"es":{"title":"","summary":"","imageAlt":"","rules":""},"en":{"title":"","summary":"","imageAlt":"","rules":""},"imageUrl":"","imageCredit":"","imageSource":""}')
ON CONFLICT (id) DO NOTHING;
GRANT SELECT, UPDATE ON tournament_call_page TO decatron_user;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'decatron_app') THEN
        GRANT SELECT, UPDATE ON tournament_call_page TO decatron_app;
    END IF;
END $$;
COMMIT;
