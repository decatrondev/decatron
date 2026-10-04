-- Overlay de chat, fase 1 (.dev/plans/CHAT_OVERLAY_EMOTES_PLAN.md).

-- Una fila por canal con toda la configuración del overlay como JSON (el front la normaliza y trae
-- los valores por defecto; el servidor solo valida lo que usa para filtrar y para resolver emotes).
CREATE TABLE IF NOT EXISTS chat_overlay_configs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id),
    config     JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chat_overlay_configs_user UNIQUE (user_id)
);
