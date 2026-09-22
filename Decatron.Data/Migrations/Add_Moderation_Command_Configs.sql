-- Moderación fase 2 (.dev/plans/MODERATION_PLAN.md): interruptor, rol mínimo y parámetros
-- de los comandos de moderación (!permit, !strikes, !resetstrikes, !addword, !addlink, !nuke).
-- Sin fila = los valores por defecto de ModerationCommandsConfig.
CREATE TABLE IF NOT EXISTS moderation_command_configs (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id),
    channel_name VARCHAR(100) NOT NULL UNIQUE,
    settings     JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_moderation_command_configs_user_id ON moderation_command_configs(user_id);

-- Los comandos también dejan rastro (quitar strikes, nuke, ...): la severidad ya no alcanza
-- para describirlos, así que el log acepta 'comando'.
ALTER TABLE moderation_logs DROP CONSTRAINT IF EXISTS chk_log_severity;
ALTER TABLE moderation_logs ADD CONSTRAINT chk_log_severity CHECK (severity IN ('leve', 'medio', 'severo', 'comando'));
