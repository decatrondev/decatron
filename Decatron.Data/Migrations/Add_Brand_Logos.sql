-- Logos de la marca controlados desde /admin/brand (.dev/plans/BRAND_LOGOS_PLAN.md). 2026-09-24
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
CREATE TABLE IF NOT EXISTS brand_assets (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(120) NOT NULL DEFAULT '',
    file_name  VARCHAR(200) NOT NULL,
    url        VARCHAR(500) NOT NULL,
    width      INT NOT NULL DEFAULT 0,
    height     INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_slots (
    slot_key   VARCHAR(60) PRIMARY KEY,
    config     JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON brand_assets, brand_slots TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE brand_assets_id_seq TO decatron_user;
