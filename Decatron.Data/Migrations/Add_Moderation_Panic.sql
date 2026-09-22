-- Moderación fase 4 (.dev/plans/MODERATION_PLAN.md): modo pánico. Una fila por canal con su
-- configuración (qué aplica, cuánto dura, disparo automático) y su estado. El estado vive en la
-- base para que el pánico se apague a tiempo aunque el bot se reinicie en medio.
CREATE TABLE IF NOT EXISTS moderation_panic (
    channel_name           VARCHAR(100) PRIMARY KEY,
    user_id                BIGINT NOT NULL REFERENCES users(id),
    settings               JSONB NOT NULL DEFAULT '{}',
    active                 BOOLEAN NOT NULL DEFAULT FALSE,
    started_at             TIMESTAMP,
    ends_at                TIMESTAMP,
    triggered_by           VARCHAR(100),
    reason                 VARCHAR(200),
    -- Cómo estaba el chat antes, para devolverlo igual al apagarse (solo los campos que se tocaron)
    previous_chat_settings JSONB,
    shield_applied         BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_moderation_panic_user_id ON moderation_panic(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_panic_active ON moderation_panic(active) WHERE active;
