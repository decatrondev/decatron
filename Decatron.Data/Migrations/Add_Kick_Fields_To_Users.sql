-- Agrega identidad de Kick a users, con el mismo patron que discord_* (columnas
-- opcionales colgadas de la fila, no una tabla aparte). Cada login de Kick es su
-- propia fila (su propio "canal"), igual que Twitch — a diferencia de Discord,
-- que solo es una identidad de login pegada a una fila ya existente.
--
-- Ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md seccion 8.5 (6 ago 2026).

ALTER TABLE users ADD COLUMN IF NOT EXISTS kick_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS kick_username VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS kick_profile_pic VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS kick_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kick_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kick_token_expiration TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kick_id ON users (kick_id) WHERE kick_id IS NOT NULL;
