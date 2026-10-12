-- Acceso y protección de la traducción en vivo (.dev/plans/TRADUCCION_ACCESO_PLAN.md, Fase 1). 2026-10-12
-- Aplicar como postgres: sudo -u postgres psql -d decatron_prod -f <este archivo>
-- Una fila por streamer. Las columnas de nivel de acceso (mode, min_follow_days, min_sub_tier, allow_list, block_list,
-- max_connections_per_user y credit_budget_per_session) se crean ya para no migrar de nuevo, pero se aplican en fases posteriores.
CREATE TABLE IF NOT EXISTS live_translation_access (
    id                         BIGSERIAL PRIMARY KEY,
    user_id                    BIGINT       NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    mode                       VARCHAR(20)  NOT NULL DEFAULT 'everyone',
    min_follow_days            INTEGER      NOT NULL DEFAULT 7,
    min_sub_tier               INTEGER      NOT NULL DEFAULT 1,
    allow_list                 TEXT         NOT NULL DEFAULT '',
    block_list                 TEXT         NOT NULL DEFAULT '',
    max_listeners_total        INTEGER      NULL,
    max_listeners_per_language INTEGER      NULL,
    max_active_languages       INTEGER      NOT NULL DEFAULT 2,
    max_connections_per_ip     INTEGER      NOT NULL DEFAULT 3,
    max_connections_per_user   INTEGER      NOT NULL DEFAULT 2,
    credit_budget_per_session  BIGINT       NULL,
    paused                     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON live_translation_access TO decatron_user;
GRANT USAGE, SELECT ON SEQUENCE live_translation_access_id_seq TO decatron_user;
