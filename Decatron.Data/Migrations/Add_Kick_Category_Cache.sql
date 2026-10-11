-- !title / !game en Kick (.dev/plans/KICK_TITULO_CATEGORIA_PLAN.md). 2026-10-11
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
-- Caché perezoso de categorías de Kick: lo que se busca en la API se guarda aquí (como game_cache en Twitch).
CREATE TABLE IF NOT EXISTS kick_category_cache (
    category_id  BIGINT PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    thumbnail    VARCHAR(500),
    usage_count  INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kick_category_cache_name ON kick_category_cache (LOWER(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON kick_category_cache TO decatron_user;
