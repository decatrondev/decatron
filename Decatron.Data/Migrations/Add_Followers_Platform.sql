-- Seguidores multiplataforma (Twitch + Kick), paso 1 de 2 (EXPANDIR). Idempotente.
-- Cada fila de channel_followers / follower_history pasa a decir de qué plataforma es. Todo lo existente es 'twitch'
-- (DEFAULT constante: PostgreSQL no reescribe la tabla). El índice único viejo (tenant_id, broadcaster_id, user_id) se
-- MANTIENE hasta que el código nuevo esté desplegado; el paso 2 es Drop_Followers_Old_Unique.sql.
-- Un id de Kick y uno de Twitch son números sin relación: sin la plataforma en la clave podrían chocar.

SET lock_timeout = '3s';

ALTER TABLE channel_followers ADD COLUMN IF NOT EXISTS platform varchar(10) NOT NULL DEFAULT 'twitch';
ALTER TABLE follower_history  ADD COLUMN IF NOT EXISTS platform varchar(10) NOT NULL DEFAULT 'twitch';

-- Clave única nueva, con plataforma. CONCURRENTLY: no bloquea escrituras (por eso este archivo no va dentro de una transacción).
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_channel_followers_platform_broadcaster_user_t
    ON channel_followers (tenant_id, platform, broadcaster_id, user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follower_history_platform_broadcaster_user
    ON follower_history (platform, broadcaster_id, user_id);
