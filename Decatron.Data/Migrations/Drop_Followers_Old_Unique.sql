-- Seguidores multiplataforma, paso 2 de 2 (CONTRAER). Aplicar SOLO después de desplegar el código que usa
-- ON CONFLICT (tenant_id, platform, broadcaster_id, user_id). Reverso:
--   CREATE UNIQUE INDEX CONCURRENTLY idx_channel_followers_broadcaster_user_t ON channel_followers (tenant_id, broadcaster_id, user_id);
SET lock_timeout = '3s';
DROP INDEX CONCURRENTLY IF EXISTS idx_channel_followers_broadcaster_user_t;
