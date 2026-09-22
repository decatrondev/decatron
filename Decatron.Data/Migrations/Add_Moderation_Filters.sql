-- Moderación fase 0 (.dev/plans/MODERATION_PLAN.md): un interruptor y una config por filtro.

-- Una fila por canal y filtro (banned_words, links, caps, ...). Si no hay fila, el filtro
-- está apagado: todos los filtros nuevos arrancan apagados.
CREATE TABLE IF NOT EXISTS moderation_filters (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id),
    channel_name VARCHAR(100) NOT NULL,
    filter_key   VARCHAR(30) NOT NULL,
    enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    -- leve (escalamiento) | medio (timeout 10 min como mínimo) | severo (ban directo).
    -- banned_words no la usa: cada palabra trae la suya.
    severity     VARCHAR(20) NOT NULL DEFAULT 'leve',
    -- Parámetros propios de cada filtro (dominios permitidos, umbrales, ...)
    settings     JSONB NOT NULL DEFAULT '{}',
    -- Mensaje del chat al sancionar; NULL = los mensajes por acción de moderation_configs
    message      VARCHAR(500),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_moderation_filter_severity CHECK (severity IN ('leve', 'medio', 'severo')),
    CONSTRAINT uq_moderation_filter_channel_key UNIQUE (channel_name, filter_key)
);
CREATE INDEX IF NOT EXISTS idx_moderation_filters_user_id ON moderation_filters(user_id);

-- Los canales que ya tenían palabras cargadas las siguen usando: quedan encendidos.
INSERT INTO moderation_filters (user_id, channel_name, filter_key, enabled)
SELECT MIN(user_id), channel_name, 'banned_words', TRUE
FROM banned_words
GROUP BY channel_name
ON CONFLICT (channel_name, filter_key) DO NOTHING;

-- Qué filtro saltó y quién ejecutó la acción (NULL = el bot automáticamente).
ALTER TABLE moderation_logs ADD COLUMN IF NOT EXISTS filter_key VARCHAR(30) NOT NULL DEFAULT 'banned_words';
ALTER TABLE moderation_logs ADD COLUMN IF NOT EXISTS executed_by VARCHAR(100);
