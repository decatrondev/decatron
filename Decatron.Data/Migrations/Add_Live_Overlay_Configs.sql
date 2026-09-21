-- Overlay "Partida en vivo" (LIVE_MATCH_OVERLAY_PLAN.md §3). 2026-09-21
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
CREATE TABLE IF NOT EXISTS live_overlay_configs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug        VARCHAR(40) NOT NULL DEFAULT 'main',
    name        VARCHAR(60) NOT NULL DEFAULT 'Principal',
    is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    canvas      JSONB NOT NULL DEFAULT '{"width":1920,"height":1080}',
    config_json JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_overlay_configs_user_slug ON live_overlay_configs (user_id, slug);
