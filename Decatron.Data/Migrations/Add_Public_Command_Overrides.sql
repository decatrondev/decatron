-- Overrides de vista pública de comandos (ocultar comando / descripción pública custom)
-- 2026-07-22

CREATE TABLE IF NOT EXISTS public_command_overrides (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(20) NOT NULL,
    command_key VARCHAR(100) NOT NULL,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    public_description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_public_command_overrides_key ON public_command_overrides(user_id, category, command_key);
